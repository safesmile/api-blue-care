import { Injectable, NotFoundException } from "@nestjs/common";
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
   */
  constructor(
    private readonly users: IdentityRepository,
    private readonly passwords: PasswordHasher
  ) {
    super();
  }
  /**
   * Creates the resource using the supplied input.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  async create(input: CreateUserDto) {
    return (
      await this.users.create(
        new User({
          firstName: input.name.slice(0, 60),
          lastName: "",
          verified: false,
          email: input.email.trim().toLowerCase(),
          name: input.name,
          passwordHash: await this.passwords.hash(input.password),
          enabled: true,
          permissions: [],
          roles: input.roles
        })
      )
    ).toView();
  }
  /**
   * Returns the resource identified by its ID.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  async read(id: string) {
    return (await this.requireUser(id)).toView();
  }
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   * @returns Result of the completed operation.
   */
  async list(page: Pagination) {
    const result = await this.users.list(page);
    return { ...result, items: result.items.map(user => user.toView()) };
  }
  /**
   * Updates the permitted resource properties.
   * @param id Resource identifier.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  async update(id: string, input: UpdateUserDto) {
    const user = await this.requireUser(id);
    if (input.name !== undefined) user.props.name = input.name;
    if (input.enabled !== undefined) user.props.enabled = input.enabled;
    if (input.roles !== undefined) user.props.roles = input.roles;
    return (await this.users.update(user)).toView();
  }
  /**
   * Deletes the resource identified by its ID.
   * @param id Resource identifier.
   */
  async delete(id: string) {
    await this.requireUser(id);
    await this.users.delete(id);
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
}
