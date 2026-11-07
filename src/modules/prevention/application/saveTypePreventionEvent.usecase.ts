import type { PreventionType } from "../domain/prevention.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { PreventionRepository, type PreventionTypeInput } from "../domain/prevention.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de PreventionEvent. */
@Injectable()
export class SaveTypePreventionEventUseCase extends EntityUseCase<
  [id: string | null, input: PreventionTypeInput, actor: AccessActor],
  Promise<PreventionType>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.PreventionConfigure] };

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
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string | null, input: PreventionTypeInput, actor: AccessActor) {
    return this.repository.saveType(id, input, actor);
  }
}
