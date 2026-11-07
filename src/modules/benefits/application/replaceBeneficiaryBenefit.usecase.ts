import type { BeneficiaryView } from "../domain/benefit-operations.repository";
import { BenefitOperationsRules } from "./benefitOperationsRules.service";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { BenefitOperationsRepository, type BeneficiaryInput } from "../domain/benefit-operations.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Benefit. */
@Injectable()
export class ReplaceBeneficiaryBenefitUseCase extends EntityUseCase<
  [id: string, beneficiaryId: string, input: BeneficiaryInput, actor: AccessActor, own?: boolean],
  Promise<BeneficiaryView>
> {
  protected readonly policy: OperationPolicy = {
    actorIndex: 3,
    permissions: [PermissionCode.BenefitsFamilyManage],
    ownPermission: PermissionCode.BenefitsSelf,
    ownIndex: 4
  };

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
   * @param id Entrada de la operación.
   * @param beneficiaryId Entrada de la operación.
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @param own Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, beneficiaryId: string, input: BeneficiaryInput, actor: AccessActor, own = false) {
    return this.operations.replaceBeneficiary(id, beneficiaryId, this.rules.familyInput(input), actor, own);
  }
}
