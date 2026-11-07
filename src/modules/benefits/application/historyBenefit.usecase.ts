import type { ConsumptionView } from "../domain/benefit-operations.repository";
import type { Page } from "../../../shared/domain/crud.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { BenefitOperationsRepository } from "../domain/benefit-operations.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Benefit. */
@Injectable()
export class HistoryBenefitUseCase extends EntityUseCase<
  [id: string, page: Pagination, actor: AccessActor, own?: boolean],
  Promise<Page<ConsumptionView>>
> {
  protected readonly policy: OperationPolicy = {
    actorIndex: 2,
    permissions: [PermissionCode.BenefitsHistory],
    ownPermission: PermissionCode.BenefitsSelf,
    ownIndex: 3
  };

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
   * @param page Entrada de la operación.
   * @param actor Entrada de la operación.
   * @param own Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, page: Pagination, actor: AccessActor, own = false) {
    return this.operations.history(id, page, actor, own);
  }
}
