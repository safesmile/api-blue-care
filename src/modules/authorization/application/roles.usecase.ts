import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RolesRepository, type RoleInput } from "../domain/roles.repository";
import { AccessPolicy, type AccessActor } from "../domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import type { Permission } from "../../../shared/domain/permission";
/** Provides explicit role operations; callers cannot bypass operation permissions. */
@Injectable()
export class RolesUseCase {
  /**
   *
   * @param roles Role definitions or assigned role names.
   */
  constructor(private readonly roles: RolesRepository) {}
  /**
   *
   * @param actor Authenticated caller and current effective grants.
   * @param permission Permission required for the operation.
   */
  private require(actor: AccessActor, permission: Permission) {
    if (!AccessPolicy.allows(actor, permission)) throw new ForbiddenException();
  }
  /**
   *
   * @param page Bounded pagination settings.
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  list(page: Pagination, actor: AccessActor) {
    this.require(actor, "roles:list");
    return this.roles.list(page);
  }
  /**
   *
   * @param id Resource identifier.
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  async read(id: string, actor: AccessActor) {
    this.require(actor, "roles:read");
    const role = await this.roles.read(id);
    if (!role) throw new NotFoundException("Role not found");
    return role;
  }
  /**
   *
   * @param input Validated definition for this operation.
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  create(input: RoleInput, actor: AccessActor) {
    this.require(actor, "roles:create");
    return this.roles.create(input, actor);
  }
  /**
   *
   * @param id Resource identifier.
   * @param input Validated definition for this operation.
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  update(id: string, input: RoleInput, actor: AccessActor) {
    this.require(actor, "roles:update");
    return this.roles.update(id, input, actor);
  }
  /**
   *
   * @param id Resource identifier.
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  delete(id: string, actor: AccessActor) {
    this.require(actor, "roles:delete");
    return this.roles.delete(id, actor);
  }
  /**
   *
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  catalog(actor: AccessActor) {
    this.require(actor, "permissions:list");
    return this.roles.catalog();
  }
}
