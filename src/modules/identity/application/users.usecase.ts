import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import { RolesRepository } from "../../authorization/domain/roles.repository";
import { personName } from "../../../shared/domain/person-name";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CrudUseCase } from "../../../shared/application/crud.usecase";
import { IdentityRepository } from "../domain/identity.repository";
import { PasswordHasher } from "../domain/password-hasher";
import { User, type UserView } from "../domain/user";
import type { CreateUserInput as CreateUserDto, UpdateUserInput as UpdateUserDto } from "./user.inputs";
import type { Pagination } from "../../../shared/domain/crud.repository";
/**
 * Applies user management rules and returns safe user views.
 */
@Injectable()
export class UsersUseCase extends CrudUseCase<UserView, CreateUserDto, UpdateUserDto> {
  /**
   * Receives the dependencies required by this component.
   * @param users User repository or user application service.
   * @param passwords Password hashing adapter.
   * @param roles Role definitions or assigned role names.
   */
  constructor(
    private readonly users: IdentityRepository,
    private readonly passwords: PasswordHasher,
    private readonly roles: RolesRepository
  ) {
    super();
  }
  /**
   * Creates the resource using the supplied input.
   * @param input Validated input for this operation.
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  async create(input: CreateUserDto, actor?: AccessActor) {
    this.authorize(actor, "users:create");
    await this.roles.authorizeAssignment(input.roles, actor!);
    const profile = personName(input.firstName, input.lastName);
    if (!profile) throw new BadRequestException("Names must be nonempty, at most 60 characters each and 120 combined");
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
   * Returns the resource identified by its ID.
   * @param id Resource identifier.
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  async read(id: string, actor?: AccessActor) {
    this.authorize(actor, "users:read", id);
    return (await this.requireUser(id)).toView();
  }
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  async list(page: Pagination, actor?: AccessActor) {
    this.authorize(actor, "users:list");
    const result = await this.users.list(page);
    return { ...result, items: result.items.map(user => user.toView()) };
  }
  /**
   * Updates the permitted resource properties.
   * @param id Resource identifier.
   * @param input Validated input for this operation.
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  async update(id: string, input: UpdateUserDto, actor?: AccessActor) {
    this.authorize(actor, "users:update", id);
    const user = await this.requireUser(id);
    if (!AccessPolicy.protectedAccount(actor, user.props.roles))
      throw new ForbiddenException("Only superadmin may modify superadmin accounts");
    if (input.firstName !== undefined || input.lastName !== undefined) {
      const profile = personName(input.firstName ?? user.props.firstName, input.lastName ?? user.props.lastName);
      if (!profile) throw new BadRequestException("Supply both name parts for incomplete historical profiles");
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
   * Deletes the resource identified by its ID.
   * @param id Resource identifier.
   * @param actor Authenticated caller and current effective grants.
   */
  async delete(id: string, actor?: AccessActor) {
    this.authorize(actor, "users:delete", id);
    const user = await this.requireUser(id);
    if (!AccessPolicy.protectedAccount(actor, user.props.roles))
      throw new ForbiddenException("Only superadmin may modify superadmin accounts");
    await this.users.delete(id, actor);
  }
  /**
   * Requires an existing user before applying an operation.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  private async requireUser(id: string) {
    const user = await this.users.read(id);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }
  /**
   * Requires explicit operation permission and owner/global identity scope.
   * @param actor Authenticated caller and current effective grants.
   * @param permission Permission required for the operation.
   * @param targetId Target identity identifier.
   */
  private authorize(
    actor: AccessActor | undefined,
    permission: "users:create" | "users:read" | "users:list" | "users:update" | "users:delete",
    targetId?: string
  ) {
    if (!AccessPolicy.identity(actor, permission, targetId))
      throw new ForbiddenException("Identity operation is outside your access");
  }
}
