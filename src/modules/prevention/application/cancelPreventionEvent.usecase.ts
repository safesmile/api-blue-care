import type { PreventionEvent } from "../domain/prevention.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { PreventionRepository } from "../domain/prevention.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de PreventionEvent. */
@Injectable()
export class CancelPreventionEventUseCase extends EntityUseCase<
  [id: string, expectedVersion: number, actor: AccessActor],
  Promise<PreventionEvent>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.PreventionCancel] };

  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   */
  constructor(private readonly repository: PreventionRepository) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param expectedVersion Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, expectedVersion: number, actor: AccessActor) {
    return this.repository.cancel(id, expectedVersion, actor);
  }
}
