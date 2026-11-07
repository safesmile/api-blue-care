import { Injectable } from "@nestjs/common";
import { NotificationRepository } from "../domain/notification.repository";
import { EntityUseCase } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Notification. */
@Injectable()
export class CancelNotificationUseCase extends EntityUseCase<[userId: string, key: string], Promise<void>> {
  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   */
  constructor(private readonly repository: NotificationRepository) {
    super();
  }
  /**
   *
   * @param userId Entrada de la operación.
   * @param key Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(userId: string, key: string) {
    return this.repository.cancel(userId, key);
  }
}
