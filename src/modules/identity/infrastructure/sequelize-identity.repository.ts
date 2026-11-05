import { recordChange } from "../../audit/infrastructure/record-change";
import { identityChange } from "../domain/identity.events";
import { clinicChange } from "../../clinics/domain/clinic.events";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import { Injectable, ConflictException, ForbiddenException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { UniqueConstraintError, QueryTypes } from "sequelize";
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
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  async create(user: User, actor?: AccessActor) {
    try {
      await this.db.transaction(async transaction => {
        if (actor) await this.authorization.assertAssignable(user.props.roles, actor, transaction);
        const { roles, email, name, passwordHash, enabled, firstName, lastName, verified } = user.props;
        await this.model.create(
          { id: user.id, email, name, passwordHash, enabled, firstName, lastName, verified },
          { transaction }
        );
        await this.authorization.setRoles(user.id, roles, transaction);
        await recordChange(
          this.db,
          transaction,
          identityChange("user.created", user.id, actor?.id, null, { id: user.id, ...user.props })
        );
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
   * @param actor Authenticated caller and current effective grants.
   * @param assignRoles Whether this update explicitly replaces role assignments.
   * @returns Result of the completed operation.
   */
  async update(user: User, actor?: AccessActor, assignRoles = false) {
    await this.db.transaction(async transaction => {
      const current = await this.model.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!current) throw new ConflictException("User no longer exists");
      const before = {
        ...current.get({ plain: true }),
        roles: await this.authorization.rolesFor(user.id, transaction)
      };
      if (!AccessPolicy.protectedAccount(actor, await this.authorization.rolesFor(user.id, transaction)))
        throw new ForbiddenException("Only superadmin may modify superadmin accounts");
      if (assignRoles && actor) await this.authorization.assertAssignable(user.props.roles, actor, transaction);
      const { roles, name, enabled, firstName, lastName } = user.props;
      await this.model.update({ name, enabled, firstName, lastName }, { where: { id: user.id }, transaction });
      if (assignRoles) await this.authorization.setRoles(user.id, roles, transaction);
      await recordChange(
        this.db,
        transaction,
        identityChange("user.updated", user.id, actor?.id, before, {
          ...before,
          name,
          enabled,
          firstName,
          lastName,
          roles: assignRoles ? roles : before.roles
        })
      );
    });
    return (await this.read(user.id))!;
  }
  /**
   * Deletes the resource identified by its ID.
   * @param id Resource identifier.
   * @param actor Authenticated caller and current effective grants.
   */
  async delete(id: string, actor?: AccessActor) {
    await this.db.transaction(async transaction => {
      const current = await this.model.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!current) return;
      const [linkedPatient] = await this.db.query<{ id: string }>('SELECT id FROM patients WHERE "userId"=:id', {
        replacements: { id },
        transaction,
        type: QueryTypes.SELECT
      });
      if (linkedPatient) throw new ConflictException("Account has a linked patient; deactivate the account instead");
      if (!AccessPolicy.protectedAccount(actor, await this.authorization.rolesFor(id, transaction)))
        throw new ForbiddenException("Only superadmin may modify superadmin accounts");
      await recordChange(
        this.db,
        transaction,
        identityChange(
          "user.deleted",
          id,
          actor?.id,
          { ...current.get({ plain: true }), roles: await this.authorization.rolesFor(id, transaction) },
          null
        )
      );
      // Assignment removals are recorded before this transaction commits the account cascade.
      const assignments = await this.db.query<{ clinicId: string; userId: string }>(
        'SELECT "clinicId","userId" FROM clinic_staff WHERE "userId"=:id ORDER BY "clinicId"',
        { replacements: { id }, transaction, type: QueryTypes.SELECT }
      );
      for (const assignment of assignments)
        await recordChange(
          this.db,
          transaction,
          clinicChange("clinic.staff-unassigned", assignment.clinicId, actor?.id, assignment, null)
        );
      await this.model.destroy({ where: { id }, transaction });
    });
  }
}
