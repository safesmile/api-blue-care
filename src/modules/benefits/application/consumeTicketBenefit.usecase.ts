import type { ConsumptionView } from "../domain/benefit-operations.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { BenefitOperationsRepository, type TicketConsumptionInput } from "../domain/benefit-operations.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Benefit. */
@Injectable()
export class ConsumeTicketBenefitUseCase extends EntityUseCase<
  [input: TicketConsumptionInput, actor: AccessActor],
  Promise<ConsumptionView>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.BenefitsConsume] };

  /**
   * Recibe las dependencias de la operación.
   * @param operations Dependencia tipada de operations.
   */
  constructor(private readonly operations: BenefitOperationsRepository) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(input: TicketConsumptionInput, actor: AccessActor) {
    return this.operations.consumeTicket(input, actor);
  }
}
