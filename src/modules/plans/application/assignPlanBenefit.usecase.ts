import { Injectable } from "@nestjs/common";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
import { PermissionCode } from "../../../shared/domain/permission-code";
import type { AccessActor } from "../../authorization/domain/access-policy";
import { PlanRepository } from "../domain/plan.repository";

/** Manages the benefits offered by a plan. */
@Injectable()
export class AssignPlanBenefitUseCase extends EntityUseCase<
  [id: string, benefitId: string, assigned: boolean, actor: AccessActor],
  Promise<void>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 3, permissions: [PermissionCode.PlansUpdate] };

  /**
   * @param plans Plan repository.
   */
  constructor(private readonly plans: PlanRepository) {
    super();
  }

  /**
   * @param id Plan identifier.
   * @param benefitId Benefit identifier.
   * @param assigned Desired assignment state.
   * @param actor Authenticated operator.
   * @returns Completion of the change.
   */
  protected perform(id: string, benefitId: string, assigned: boolean, actor: AccessActor) {
    return this.plans.assignBenefit(id, benefitId, assigned, actor);
  }
}
