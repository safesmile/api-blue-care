import type { PlanVersion } from "../domain/plan.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PlanRepository, type PlanVersionInput } from "../domain/plan.repository";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Plan. */
@Injectable()
export class VersionPlanUseCase extends EntityUseCase<
  [id: string, input: PlanVersionInput & { draftId?: string }, actor: AccessActor],
  Promise<PlanVersion>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.PlansVersion] };

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
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, input: PlanVersionInput, actor: AccessActor) {
    if (input.maxBeneficiaries !== undefined && !AccessPolicy.allows(actor, PermissionCode.BenefitsFamilySettings))
      throw new ForbiddenException("No tiene permiso para cambiar el límite de familiares");
    if (
      !Number.isSafeInteger(input.monthlyPriceCents) ||
      input.monthlyPriceCents < 500 ||
      input.monthlyPriceCents > 100000000
    )
      throw new BadRequestException("El precio mensual final debe ser un entero entre 500 y 100000000 centavos de GTQ");
    if (
      !Number.isSafeInteger(input.annualPriceCents) ||
      input.annualPriceCents < 500 ||
      input.annualPriceCents > 1000000000
    )
      throw new BadRequestException("El precio anual final debe ser un entero entre 500 y 1000000000 centavos de GTQ");
    return this.plans.version(id, input, actor);
  }
}
