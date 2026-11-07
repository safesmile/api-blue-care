import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable, NotFoundException } from "@nestjs/common";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { PushRepository } from "../domain/push.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Push. */
@Injectable()
export class RemovePushUseCase extends EntityUseCase<[id: string, actor: AccessActor], Promise<void>> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.NotificationsDevices] };

  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   */
  constructor(private readonly repository: PushRepository) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   */
  protected async perform(id: string, actor: AccessActor) {
    if (!(await this.repository.remove(actor.id, id))) throw new NotFoundException("No se encontró el dispositivo");
  }
}
