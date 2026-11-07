import type { PushDevice } from "../domain/push.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { PushRepository, type PushDeviceInput } from "../domain/push.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Push. */
@Injectable()
export class RegisterPushUseCase extends EntityUseCase<
  [input: PushDeviceInput, actor: AccessActor],
  Promise<PushDevice>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.NotificationsDevices] };

  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   */
  constructor(private readonly repository: PushRepository) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(input: PushDeviceInput, actor: AccessActor) {
    return this.repository.register(actor.id, input);
  }
}
