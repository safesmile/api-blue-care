import type { RoleView } from "../domain/roles.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable, NotFoundException } from "@nestjs/common";
import { RolesRepository, type RoleInput } from "../domain/roles.repository";
import { type AccessActor } from "../domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { CrudEntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
interface CrudRolesUseCaseOperations {
  list: (page: Pagination, actor: AccessActor) => Promise<{ items: RoleView[]; total: number }>;
  read: (id: string, actor: AccessActor) => Promise<RoleView>;
  create: (input: RoleInput, actor: AccessActor) => Promise<RoleView>;
  update: (id: string, input: RoleInput, actor: AccessActor) => Promise<RoleView>;
  delete: (id: string, actor: AccessActor) => Promise<void>;
}

/** Operaciones CRUD de Role. */
@Injectable()
export class CrudRolesUseCase extends CrudEntityUseCase<CrudRolesUseCaseOperations> {
  protected readonly asynchronousActions = ["read"];

  protected readonly handlers = {
    list: this.listEntity.bind(this),
    read: this.readEntity.bind(this),
    create: this.createEntity.bind(this),
    update: this.updateEntity.bind(this),
    delete: this.deleteEntity.bind(this)
  };
  protected readonly policies: Partial<Record<keyof CrudRolesUseCaseOperations, OperationPolicy>> = {
    list: { actorIndex: 1, permissions: [PermissionCode.RolesList] },
    read: { actorIndex: 1, permissions: [PermissionCode.RolesRead] },
    create: { actorIndex: 1, permissions: [PermissionCode.RolesCreate] },
    update: { actorIndex: 2, permissions: [PermissionCode.RolesUpdate] },
    delete: { actorIndex: 1, permissions: [PermissionCode.RolesDelete] }
  };

  /**
   * Recibe las dependencias de la operación.
   * @param roles Dependencia tipada de roles.
   */
  constructor(private readonly roles: RolesRepository) {
    super();
  }
  /**
   *
   * @param page Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected listEntity(page: Pagination) {
    return this.roles.list(page);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async readEntity(id: string) {
    const role = await this.roles.read(id);
    if (!role) throw new NotFoundException("No se encontró el rol");
    return role;
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected createEntity(input: RoleInput, actor: AccessActor) {
    return this.roles.create(input, actor);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected updateEntity(id: string, input: RoleInput, actor: AccessActor) {
    return this.roles.update(id, input, actor);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected deleteEntity(id: string, actor: AccessActor) {
    return this.roles.delete(id, actor);
  }
}
