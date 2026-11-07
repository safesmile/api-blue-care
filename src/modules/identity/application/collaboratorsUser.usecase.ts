import type { CollaboratorView } from "../domain/user";
import type { Page } from "../../../shared/domain/crud.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { Injectable } from "@nestjs/common";
import { IdentityRepository } from "../domain/identity.repository";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de User. */
@Injectable()
export class CollaboratorsUserUseCase extends EntityUseCase<
  [page: Pagination, actor: AccessActor],
  Promise<Page<CollaboratorView>>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.ClinicsStaffList] };

  /**
   * Recibe las dependencias de la operación.
   * @param users Dependencia tipada de users.
   */
  constructor(private readonly users: IdentityRepository) {
    super();
  }
  /**
   *
   * @param page Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(page: Pagination, actor: AccessActor) {
    return this.users.collaborators(page, actor);
  }
}
