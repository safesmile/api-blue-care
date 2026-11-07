import { PermissionCode } from "../../../shared/domain/permission-code";
import { recordChange } from "../../audit/infrastructure/record-change";
import { identityChange } from "../domain/identity.events";
import { clinicChange } from "../../clinics/domain/clinic.events";
import { PERSONAL_PERMISSION_CODES, AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import { Injectable, ConflictException, ForbiddenException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Transaction, UniqueConstraintError, QueryTypes } from "sequelize";
import { IdentityRepository } from "../domain/identity.repository";
import { Sequelize } from "sequelize-typescript";
import { AuthorizationStore } from "../../authorization/infrastructure/authorization.store";
import { User, type CollaboratorView } from "../domain/user";
import { UserModel } from "./user.model";
import type { Pagination } from "../../../shared/domain/crud.repository";
/**
 * Maps domain users to PostgreSQL through Sequelize.
 */
@Injectable()
export class SequelizeIdentityRepository extends IdentityRepository {
  /**
   * Recibe las dependencias de la operación.
   * @param model Dependencia tipada de model.
   * @param db Dependencia tipada de db.
   * @param authorization Dependencia tipada de authorization.
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
      if (error instanceof UniqueConstraintError) throw new ConflictException("El correo electrónico ya existe");
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
   * Lists staff identities with only clinics visible to the current staff administrator.
   * @param page Bounded pagination.
   * @param actor Current operator and selected clinic.
   * @param id Optional exact identity filter for a detail view.
   * @returns Scoped staff directory.
   */
  async collaborators(page: Pagination, actor: AccessActor, id?: string) {
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      const grants = await this.authorization.permissionsFor(
        await this.authorization.rolesFor(actor.id, transaction),
        transaction
      );
      const global = grants.includes(PermissionCode.ClinicsAll) && grants.includes(PermissionCode.ClinicsStaffList);
      const visible = `SELECT 1 FROM clinic_staff s JOIN clinics c ON c.id=s."clinicId"
        WHERE s."userId"=u.id AND c.enabled AND (:selected IS NULL OR c.id=CAST(:selected AS UUID))
        AND (:global OR blue_care_clinic_allowed(:actorId,c.id,CAST(:selected AS UUID),'clinics:staff-list'))`;
      const filter = `WHERE (:id IS NULL OR u.id=CAST(:id AS UUID)) AND (EXISTS(SELECT 1 FROM staff_profiles sp WHERE sp."userId"=u.id)
        OR EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur."roleId"
        LEFT JOIN role_permissions rp ON rp."roleId"=r.id WHERE ur."userId"=u.id AND ur."clinicId" IS NULL
        AND (r.name='staff' OR rp."permissionCode" NOT IN (:personal))))
      AND ((:global AND :selected IS NULL) OR EXISTS(${visible}))`;
      const replacements = {
        ...page,
        personal: PERSONAL_PERMISSION_CODES,
        id: id ?? null,
        actorId: actor.id,
        selected: actor.clinicId ?? null,
        global
      };
      const rows = await this.db.query<Omit<CollaboratorView, "roles" | "clinics">>(
        `SELECT u.id,u.email,u.name,u."firstName",u."lastName",u.enabled,u.verified FROM users u ${filter} ORDER BY u.name,u.id LIMIT :limit OFFSET :offset`,
        { replacements, transaction, type: QueryTypes.SELECT }
      );
      const [count] = await this.db.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM users u ${filter}`, {
        replacements,
        transaction,
        type: QueryTypes.SELECT
      });
      const items: CollaboratorView[] = [];
      for (const user of rows) {
        const clinics = await this.db.query<{ id: string; name: string; roles: string[] }>(
          `SELECT c.id,c.name,COALESCE((SELECT ARRAY_AGG(r.name ORDER BY r.name) FROM user_roles ur JOIN roles r ON r.id=ur."roleId"
          WHERE ur."userId"=:userId AND ur."clinicId"=c.id),'{}') AS roles
          FROM clinics c JOIN clinic_staff s ON s."clinicId"=c.id WHERE s."userId"=:userId AND c.enabled AND (:selected IS NULL OR c.id=CAST(:selected AS UUID))
          AND (:global OR blue_care_clinic_allowed(:actorId,c.id,CAST(:selected AS UUID),'clinics:staff-list')) ORDER BY c.name,c.id`,
          { replacements: { ...replacements, userId: user.id }, transaction, type: QueryTypes.SELECT }
        );
        items.push({ ...user, roles: global ? await this.authorization.rolesFor(user.id, transaction) : [], clinics });
      }
      return { items, total: count.total };
    });
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
      if (!current) throw new ConflictException("El usuario ya no existe");
      const before = {
        ...current.get({ plain: true }),
        roles: await this.authorization.rolesFor(user.id, transaction)
      };
      if (!AccessPolicy.protectedAccount(actor, await this.authorization.rolesFor(user.id, transaction)))
        throw new ForbiddenException("Solo un superadministrador puede modificar cuentas de superadministrador");
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
      if (linkedPatient)
        throw new ConflictException(
          "La cuenta tiene un paciente vinculado; desactive la cuenta en lugar de eliminarla"
        );
      if (!AccessPolicy.protectedAccount(actor, await this.authorization.rolesFor(id, transaction)))
        throw new ForbiddenException("Solo un superadministrador puede modificar cuentas de superadministrador");
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
