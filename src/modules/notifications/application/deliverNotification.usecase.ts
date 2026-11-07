import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationRepository } from "../domain/notification.repository";
import { EmailSender } from "../../../shared/domain/email-sender";
import { EntityUseCase } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Notification. */
@Injectable()
export class DeliverNotificationUseCase extends EntityUseCase<[id: string], Promise<boolean>> {
  private readonly logger = new Logger(DeliverNotificationUseCase.name);
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   * @param mail Dependencia tipada de mail.
   * @param config Dependencia tipada de config.
   */
  constructor(
    private readonly repository: NotificationRepository,
    private readonly mail: EmailSender,
    private readonly config: ConfigService
  ) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async perform(id: string): Promise<boolean> {
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
}
