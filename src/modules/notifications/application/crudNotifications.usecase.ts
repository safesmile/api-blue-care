import type { InboxNotification } from "../domain/notification.repository";
import { Injectable } from "@nestjs/common";
import { NotificationRepository } from "../domain/notification.repository";
import { CrudEntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
interface CrudNotificationsUseCaseOperations {
  list: (userId: string, limit: number, offset: number) => Promise<{ items: InboxNotification[]; total: number }>;
}

/** Operaciones CRUD de Notification. */
@Injectable()
export class CrudNotificationsUseCase extends CrudEntityUseCase<CrudNotificationsUseCaseOperations> {
  protected readonly handlers = { list: this.listEntity.bind(this) };
  protected readonly policies: Partial<Record<keyof CrudNotificationsUseCaseOperations, OperationPolicy>> = {};

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
   * @param limit Entrada de la operación.
   * @param offset Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected listEntity(userId: string, limit: number, offset: number) {
    return this.repository.list(userId, limit, offset);
  }
}
