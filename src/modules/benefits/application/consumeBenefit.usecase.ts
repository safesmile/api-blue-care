import type { ConsumptionView } from "../domain/benefit-operations.repository";
import { BenefitOperationsRules } from "./benefitOperationsRules.service";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { BenefitOperationsRepository, type ConsumptionInput } from "../domain/benefit-operations.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Benefit. */
@Injectable()
export class ConsumeBenefitUseCase extends EntityUseCase<
  [input: ConsumptionInput, actor: AccessActor],
  Promise<ConsumptionView>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.BenefitsConsume] };

  /**
   * Recibe las dependencias de la operación.
   * @param operations Dependencia tipada de operations.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly operations: BenefitOperationsRepository,
    private readonly rules: BenefitOperationsRules
  ) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(input: ConsumptionInput, actor: AccessActor) {
    this.rules.units(input.units);
    return this.operations.consume(input, actor);
  }
}
