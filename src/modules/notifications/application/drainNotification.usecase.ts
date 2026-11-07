import { Injectable } from "@nestjs/common";
import { NotificationRepository } from "../domain/notification.repository";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
import { DeliverNotificationUseCase } from "./deliverNotification.usecase";

/** Caso de uso específico de Notification. */
@Injectable()
export class DrainNotificationUseCase extends EntityUseCase<[], Promise<{ sent: number }>> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   * @param deliverOperation Dependencia tipada de deliverOperation.
   */
  constructor(
    private readonly repository: NotificationRepository,
    private readonly deliverOperation: DeliverNotificationUseCase
  ) {
    super();
  }
  /**
   *
   * @returns Resultado de la operación.
   */
  protected async perform() {
    let sent = 0;
    const stopAt = Date.now() + 30000;
    for (const id of await this.repository.pending()) {
      if (Date.now() >= stopAt) break;
      if (await this.deliverOperation.execute(id)) sent++;
    }
    return { sent };
  }
}
