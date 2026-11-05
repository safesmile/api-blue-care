import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationRepository, type NotificationInput } from "../domain/notification.repository";
import { JobQueue } from "../../../shared/domain/job-queue";
import { EmailSender } from "../../../shared/domain/email-sender";
/** Coordinates a durable inbox and email delivery without accepting recipient IDs from public endpoints. */
@Injectable()
export class NotificationsUseCase {
  private readonly logger = new Logger(NotificationsUseCase.name);
  /**
   *
   * @param repository Persistent notification storage.
   * @param jobs Durable task queue.
   * @param mail Configured email transport.
   * @param config Validated application settings.
   */
  constructor(
    private readonly repository: NotificationRepository,
    private readonly jobs: JobQueue,
    private readonly mail: EmailSender,
    private readonly config: ConfigService
  ) {}
  /**
   * Records a business notification before requesting asynchronous delivery.
   * @param input Validated operation input.
   * @returns Result of the completed operation.
   */
  async notify(input: NotificationInput) {
    if (
      !input.key ||
      input.key.length > 200 ||
      !input.title ||
      input.title.length > 200 ||
      !input.body ||
      input.body.length > 10000
    )
      throw new Error("Invalid notification content");
    const record = await this.repository.create(input);
    if (record.deliveryId) {
      try {
        await this.jobs.enqueue({
          id: "notification-" + record.deliveryId,
          path: "/api/v1/internal/jobs/notifications/deliver",
          payload: { id: record.deliveryId },
          runAt: input.deliverAt
        });
      } catch {
        this.logger.warn("Notification persisted; cloud dispatch awaits recovery sweep");
      }
    }
    return record.id;
  }
  /**
   * Lists only notifications belonging to the authenticated identity.
   * @param userId Owner identity from the authenticated session.
   * @param limit Maximum number of records.
   * @param offset Number of records to skip.
   * @returns Result of the completed operation.
   */
  list(userId: string, limit: number, offset: number) {
    return this.repository.list(userId, limit, offset);
  }
  /**
   * Marks a visible notification as read without revealing another identity's data.
   * @param userId Owner identity from the authenticated session.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  async markRead(userId: string, id: string) {
    if (!(await this.repository.markRead(userId, id))) throw new NotFoundException("Notification not found");
  }
  /**
   * Cancels unsent deliveries when the originating business event is superseded.
   * @param userId Owner identity from the authenticated session.
   * @param key Stable business event key.
   * @returns Result of the completed operation.
   */
  cancel(userId: string, key: string) {
    return this.repository.cancel(userId, key);
  }
  /**
   * Delivers one leased record; false asks Cloud Tasks to retry later.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  async deliver(id: string): Promise<boolean> {
    const delivery = await this.repository.claim(id);
    if (delivery === "done") return true;
    if (!delivery) return false;
    let success = false;
    try {
      await this.mail.send({
        to: delivery.email,
        subject: delivery.title,
        text: delivery.body,
        messageId: "<" + delivery.id + "@blue-care.notifications>"
      });
      success = true;
    } catch {
      this.logger.warn("Notification email delivery failed; see persisted delivery status");
    }
    await this.repository.finish(delivery, success, Number(this.config.get("NOTIFICATION_MAX_ATTEMPTS") || 5));
    return success;
  }
  /**
   * Recovers pending deliveries, including failures to publish Cloud Tasks.
   * @returns Result of the completed operation.
   */
  async drain() {
    let sent = 0;
    const stopAt = Date.now() + 30000;
    for (const id of await this.repository.pending()) {
      if (Date.now() >= stopAt) break;
      if (await this.deliver(id)) sent++;
    }
    return { sent };
  }
}
