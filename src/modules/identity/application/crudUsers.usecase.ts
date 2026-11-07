import type { Permission } from "../../../shared/domain/permission";
import { UsersRules } from "./usersRules.service";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import { RolesRepository } from "../../authorization/domain/roles.repository";
import { personName } from "../../../shared/domain/person-name";
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { IdentityRepository } from "../domain/identity.repository";
import { PasswordHasher } from "../domain/password-hasher";
import { User } from "../domain/user";
import type { CreateUserInput as CreateUserDto, UpdateUserInput as UpdateUserDto } from "./user.inputs";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { CrudEntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
interface CrudUsersUseCaseOperations {
  create: (
    input: CreateUserDto,
    actor?: AccessActor
  ) => Promise<{
    id: string;
    email: string;
    name: string;
    enabled: boolean;
    permissions: Permission[];
    roles: string[];
    firstName: string;
    lastName: string;
    verified: boolean;
  }>;
  read: (
    id: string,
    actor?: AccessActor
  ) => Promise<{
    id: string;
    email: string;
    name: string;
    enabled: boolean;
    permissions: Permission[];
    roles: string[];
    firstName: string;
    lastName: string;
    verified: boolean;
  }>;
  list: (
    page: Pagination,
    actor?: AccessActor
  ) => Promise<{
    items: {
      id: string;
      email: string;
      name: string;
      enabled: boolean;
      permissions: Permission[];
      roles: string[];
      firstName: string;
      lastName: string;
      verified: boolean;
    }[];
    total: number;
  }>;
  update: (
    id: string,
    input: UpdateUserDto,
    actor?: AccessActor
  ) => Promise<{
    id: string;
    email: string;
    name: string;
    enabled: boolean;
    permissions: Permission[];
    roles: string[];
    firstName: string;
    lastName: string;
    verified: boolean;
  }>;
  delete: (id: string, actor?: AccessActor) => Promise<void>;
}

/** Operaciones CRUD de User. */
@Injectable()
export class CrudUsersUseCase extends CrudEntityUseCase<CrudUsersUseCaseOperations> {
  protected readonly asynchronousActions = ["create", "read", "list", "update", "delete"];

  protected readonly handlers = {
    create: this.createEntity.bind(this),
    read: this.readEntity.bind(this),
    list: this.listEntity.bind(this),
    update: this.updateEntity.bind(this),
    delete: this.deleteEntity.bind(this)
  };
  protected readonly policies: Partial<Record<keyof CrudUsersUseCaseOperations, OperationPolicy>> = {
    create: { actorIndex: 1, permissions: [PermissionCode.UsersCreate], identity: true },
    read: { actorIndex: 1, permissions: [PermissionCode.UsersRead], identity: true, targetIndex: 0 },
    list: { actorIndex: 1, permissions: [PermissionCode.UsersList], identity: true },
    update: { actorIndex: 2, permissions: [PermissionCode.UsersUpdate], identity: true, targetIndex: 0 },
    delete: { actorIndex: 1, permissions: [PermissionCode.UsersDelete], identity: true, targetIndex: 0 }
  };

  /**
   * Recibe las dependencias de la operación.
   * @param users Dependencia tipada de users.
   * @param passwords Dependencia tipada de passwords.
   * @param roles Dependencia tipada de roles.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly users: IdentityRepository,
    private readonly passwords: PasswordHasher,
    private readonly roles: RolesRepository,
    private readonly rules: UsersRules
  ) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async createEntity(input: CreateUserDto, actor?: AccessActor) {
    await this.roles.authorizeAssignment(input.roles, actor!);
    const profile = personName(input.firstName, input.lastName);
    if (!profile)
      throw new BadRequestException(
        "El nombre y apellido son obligatorios, con un máximo de 60 caracteres cada uno y 120 en total"
      );
    return (
      await this.users.create(
        new User({
          ...profile,
          verified: false,
          email: input.email.trim().toLowerCase(),
          passwordHash: await this.passwords.hash(input.password),
          enabled: true,
          permissions: [],
          roles: input.roles
        }),
        actor
      )
    ).toView();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async readEntity(id: string) {
    return (await this.rules.requireUser(id)).toView();
  }
  /**
   *
   * @param page Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async listEntity(page: Pagination) {
    const result = await this.users.list(page);
    return { ...result, items: result.items.map(user => user.toView()) };
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async updateEntity(id: string, input: UpdateUserDto, actor?: AccessActor) {
    const user = await this.rules.requireUser(id);
    if (!AccessPolicy.protectedAccount(actor, user.props.roles))
      throw new ForbiddenException("Solo un superadministrador puede modificar cuentas de superadministrador");
    if (input.firstName !== undefined || input.lastName !== undefined) {
      const profile = personName(input.firstName ?? user.props.firstName, input.lastName ?? user.props.lastName);
      if (!profile) throw new BadRequestException("Indique nombre y apellido para completar los perfiles históricos");
      Object.assign(user.props, profile);
    }
    if (input.enabled !== undefined) user.props.enabled = input.enabled;
    if (input.roles !== undefined) {
      await this.roles.authorizeAssignment(input.roles, actor!);
      user.props.roles = input.roles;
    }
    return (await this.users.update(user, actor, input.roles !== undefined)).toView();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   */
  protected async deleteEntity(id: string, actor?: AccessActor) {
    const user = await this.rules.requireUser(id);
    if (!AccessPolicy.protectedAccount(actor, user.props.roles))
      throw new ForbiddenException("Solo un superadministrador puede modificar cuentas de superadministrador");
    await this.users.delete(id, actor);
  }
}
