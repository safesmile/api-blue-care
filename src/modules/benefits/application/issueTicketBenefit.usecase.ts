import { BenefitOperationsRules } from "./benefitOperationsRules.service";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { BenefitOperationsRepository, type TicketInput } from "../domain/benefit-operations.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Benefit. */
@Injectable()
export class IssueTicketBenefitUseCase extends EntityUseCase<
  [id: string, input: TicketInput, actor: AccessActor],
  Promise<{ id: string; token: string; expiresAt: Date }>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.BenefitsSelf] };

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
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, input: TicketInput, actor: AccessActor) {
    this.rules.units(input.units);
    return this.operations.issueTicket(id, input, actor);
  }
}
