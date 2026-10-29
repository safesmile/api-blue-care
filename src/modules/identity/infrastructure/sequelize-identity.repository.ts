import { Injectable, ConflictException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { UniqueConstraintError } from "sequelize";
import { IdentityRepository } from "../domain/identity.repository";
import { Sequelize } from "sequelize-typescript";
import { AuthorizationStore } from "../../authorization/infrastructure/authorization.store";
import { User } from "../domain/user";
import { UserModel } from "./user.model";
import type { Pagination } from "../../../shared/domain/crud.repository";
/**
 * Maps domain users to PostgreSQL through Sequelize.
 */
@Injectable()
export class SequelizeIdentityRepository extends IdentityRepository {
  /**
   * Receives the dependencies required by this component.
   * @param model Sequelize model used for persistence.
   * @param db Database transaction connection.
   * @param authorization Resolves and persists relational role assignments.
   */
  constructor(
    @InjectModel(UserModel) private readonly model: typeof UserModel,
    private readonly db: Sequelize,
    private readonly authorization: AuthorizationStore
  ) {
    super();
  }
  /**
   * Converts a persistence model to a domain entity.
   * @param row Persistence row to map.
   * @returns Result of the completed operation.
   */
  private async map(row: UserModel) {
    const roles = await this.authorization.rolesFor(row.id);
    return new User(
      {
        firstName: row.firstName,
        lastName: row.lastName,
        verified: row.verified,
        email: row.email,
        name: row.name,
        passwordHash: row.passwordHash,
        enabled: row.enabled,
        roles,
        permissions: await this.authorization.permissionsFor(roles)
      },
      row.id
    );
  }
  /**
   * Creates the resource using the supplied input.
   * @param user Domain user to persist.
   * @returns Result of the completed operation.
   */
  async create(user: User) {
    try {
      await this.db.transaction(async transaction => {
        const { roles, email, name, passwordHash, enabled, firstName, lastName, verified } = user.props;
        const props = { email, name, passwordHash, enabled, firstName, lastName, verified };
        await this.model.create({ id: user.id, ...props }, { transaction });
        await this.authorization.setRoles(user.id, roles, transaction);
      });
      return (await this.read(user.id))!;
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw new ConflictException("Email already exists");
      throw error;
    }
  }
  /**
   * Returns the resource identified by its ID.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  async read(id: string) {
    const row = await this.model.findByPk(id);
    return row ? this.map(row) : null;
  }
  /**
   * Finds a user by normalized email.
   * @param email Account email address.
   * @returns Result of the completed operation.
   */
  async findByEmail(email: string) {
    const row = await this.model.findOne({ where: { email } });
    return row ? this.map(row) : null;
  }
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   * @returns Result of the completed operation.
   */
  async list(page: Pagination) {
    const result = await this.model.findAndCountAll({
      ...page,
      order: [["id", "ASC"]]
    });
    return {
      items: await Promise.all(result.rows.map(row => this.map(row))),
      total: result.count
    };
  }
  /**
   * Updates the permitted resource properties.
   * @param user Domain user to persist.
   * @returns Result of the completed operation.
   */
  async update(user: User) {
    await this.db.transaction(async transaction => {
      const { roles, email, name, passwordHash, enabled, firstName, lastName, verified } = user.props;
      await this.model.update(
        { email, name, passwordHash, enabled, firstName, lastName, verified },
        { where: { id: user.id }, transaction }
      );
      await this.authorization.setRoles(user.id, roles, transaction);
    });
    return (await this.read(user.id))!;
  }
  /**
   * Deletes the resource identified by its ID.
   * @param id Resource identifier.
   */
  async delete(id: string) {
    await this.model.destroy({ where: { id } });
  }
}
