import type { PlanView } from "../domain/plan.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { PlanRepository } from "../domain/plan.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Plan. */
@Injectable()
export class PublishPlanUseCase extends EntityUseCase<
  [id: string, versionId: string, actor: AccessActor],
  Promise<PlanView>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.PlansPublish] };

  /**
   * Recibe las dependencias de la operación.
   * @param plans Dependencia tipada de plans.
   */
  constructor(private readonly plans: PlanRepository) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param versionId Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, versionId: string, actor: AccessActor) {
    return this.plans.publish(id, versionId, actor);
  }
}
