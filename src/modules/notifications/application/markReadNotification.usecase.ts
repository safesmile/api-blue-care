import { Injectable, NotFoundException } from "@nestjs/common";
import { NotificationRepository } from "../domain/notification.repository";
import { EntityUseCase } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Notification. */
@Injectable()
export class MarkReadNotificationUseCase extends EntityUseCase<[userId: string, id: string], Promise<void>> {
  protected readonly asynchronous = true;

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
   * @param id Entrada de la operación.
   */
  protected async perform(userId: string, id: string) {
    if (!(await this.repository.markRead(userId, id))) throw new NotFoundException("No se encontró la notificación");
  }
}
