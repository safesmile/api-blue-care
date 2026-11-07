import type { BenefitVersion } from "../domain/benefit.repository";
import type { Page } from "../../../shared/domain/crud.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { BenefitRepository } from "../domain/benefit.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Benefit. */
@Injectable()
export class VersionsBenefitUseCase extends EntityUseCase<
  [id: string, page: Pagination, actor: AccessActor],
  Promise<Page<BenefitVersion>>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.BenefitsRead] };

  /**
   * Recibe las dependencias de la operación.
   * @param benefits Dependencia tipada de benefits.
   */
  constructor(private readonly benefits: BenefitRepository) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param page Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, page: Pagination) {
    return this.benefits.versions(id, page);
  }
}
