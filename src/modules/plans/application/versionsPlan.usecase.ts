import type { PlanVersion } from "../domain/plan.repository";
import type { Page } from "../../../shared/domain/crud.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { PlanRepository } from "../domain/plan.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Plan. */
@Injectable()
export class VersionsPlanUseCase extends EntityUseCase<
  [id: string, page: Pagination, actor: AccessActor],
  Promise<Page<PlanVersion>>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.PlansRead] };

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
   * @param page Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, page: Pagination) {
    return this.plans.versions(id, page);
  }
}
