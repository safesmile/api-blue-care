import type { PermissionDefinition } from "../../../shared/domain/permission";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { RolesRepository } from "../domain/roles.repository";
import { type AccessActor } from "../domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Role. */
@Injectable()
export class CatalogRoleUseCase extends EntityUseCase<[actor: AccessActor], Promise<PermissionDefinition[]>> {
  protected readonly policy: OperationPolicy = { actorIndex: 0, permissions: [PermissionCode.PermissionsList] };

  /**
   * Recibe las dependencias de la operación.
   * @param roles Dependencia tipada de roles.
   */
  constructor(private readonly roles: RolesRepository) {
    super();
  }
  /**
   *
   * @returns Resultado de la operación.
   */
  protected perform() {
    return this.roles.catalog();
  }
}
