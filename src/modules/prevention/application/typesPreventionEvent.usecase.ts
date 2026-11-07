import type { PreventionType } from "../domain/prevention.repository";
import type { Page } from "../../../shared/domain/crud.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { PreventionRepository } from "../domain/prevention.repository";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de PreventionEvent. */
@Injectable()
export class TypesPreventionEventUseCase extends EntityUseCase<
  [page: Pagination, actor: AccessActor],
  Promise<Page<PreventionType>>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.PreventionRead] };

  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   */
  constructor(private readonly repository: PreventionRepository) {
    super();
  }
  /**
   *
   * @param page Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(page: Pagination) {
    return this.repository.types(page);
  }
}
