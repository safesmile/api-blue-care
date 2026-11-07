import { PermissionCode } from "../../../shared/domain/permission-code";
import { BadRequestException, Injectable } from "@nestjs/common";
import { BenefitRepository } from "../domain/benefit.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Benefit. */
@Injectable()
export class UpdateFamilySettingsBenefitUseCase extends EntityUseCase<
  [planId: string, max: number, actor: AccessActor],
  Promise<{ planId: string; maxBeneficiaries: number }>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.BenefitsFamilySettings] };

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
   * @param max Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(planId: string, max: number, actor: AccessActor) {
    if (!Number.isSafeInteger(max) || max < 0 || max > 100)
      throw new BadRequestException("El máximo de familiares no es válido");
    return this.benefits.updateFamilySettings(planId, max, actor);
  }
}
