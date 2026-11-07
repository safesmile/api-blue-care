import type { ReversalView } from "../domain/benefit-operations.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { BadRequestException, Injectable } from "@nestjs/common";
import { BenefitOperationsRepository } from "../domain/benefit-operations.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Benefit. */
@Injectable()
export class ReverseBenefitUseCase extends EntityUseCase<
  [id: string, reason: string, idempotencyKey: string, actor: AccessActor],
  Promise<ReversalView>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 3, permissions: [PermissionCode.BenefitsReverse] };

  /**
   * Recibe las dependencias de la operación.
   * @param operations Dependencia tipada de operations.
   */
  constructor(private readonly operations: BenefitOperationsRepository) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param reason Entrada de la operación.
   * @param idempotencyKey Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, reason: string, idempotencyKey: string, actor: AccessActor) {
    if (!reason.trim() || reason.trim().length > 500)
      throw new BadRequestException("Se requiere un motivo de corrección de 1 a 500 caracteres");
    return this.operations.reverse(id, reason.trim(), idempotencyKey, actor);
  }
}
