import { Injectable, Logger } from "@nestjs/common";
import { NotificationRepository, type NotificationInput } from "../domain/notification.repository";
import { JobQueue } from "../../../shared/domain/job-queue";
import { EntityUseCase } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Notification. */
@Injectable()
export class NotifyNotificationUseCase extends EntityUseCase<[input: NotificationInput], Promise<string>> {
  private readonly logger = new Logger(NotifyNotificationUseCase.name);
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   * @param jobs Dependencia tipada de jobs.
   */
  constructor(
    private readonly repository: NotificationRepository,
    private readonly jobs: JobQueue
  ) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async perform(input: NotificationInput) {
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
}
