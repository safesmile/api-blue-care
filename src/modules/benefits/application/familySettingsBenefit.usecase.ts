import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { BenefitRepository } from "../domain/benefit.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Benefit. */
@Injectable()
export class FamilySettingsBenefitUseCase extends EntityUseCase<
  [planId: string, actor: AccessActor],
  Promise<{ planId: string; maxBeneficiaries: number }>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.BenefitsRead] };

  /**
   * Recibe las dependencias de la operación.
   * @param benefits Dependencia tipada de benefits.
   */
  constructor(private readonly benefits: BenefitRepository) {
    super();
  }
  /**
   *
   * @param planId Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(planId: string) {
    return this.benefits.familySettings(planId);
  }
}
