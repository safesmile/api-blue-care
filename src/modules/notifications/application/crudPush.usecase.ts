import type { PushDevice } from "../domain/push.repository";
import type { Page } from "../../../shared/domain/crud.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { PushRepository } from "../domain/push.repository";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { CrudEntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
interface CrudPushUseCaseOperations {
  list: (page: Pagination, actor: AccessActor) => Promise<Page<PushDevice>>;
}

/** Operaciones CRUD de Push. */
@Injectable()
export class CrudPushUseCase extends CrudEntityUseCase<CrudPushUseCaseOperations> {
  protected readonly handlers = { list: this.listEntity.bind(this) };
  protected readonly policies: Partial<Record<keyof CrudPushUseCaseOperations, OperationPolicy>> = {
    list: { actorIndex: 1, permissions: [PermissionCode.NotificationsDevices] }
  };

  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   */
  constructor(private readonly repository: PushRepository) {
    super();
  }
  /**
   *
   * @param page Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected listEntity(page: Pagination, actor: AccessActor) {
    return this.repository.list(actor.id, page);
  }
}
