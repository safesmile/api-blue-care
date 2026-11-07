import { recordChange } from "../../audit/infrastructure/record-change";
import { roleChange } from "../domain/authorization.events";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, UniqueConstraintError, type Transaction } from "sequelize";
import { randomUUID } from "node:crypto";
import { RolesRepository, type RoleInput, type RoleView } from "../domain/roles.repository";
import { AccessPolicy, type AccessActor } from "../domain/access-policy";
import { AuthorizationStore } from "./authorization.store";
import { REGISTERED_PERMISSIONS } from "./permission-registry";
import type { Pagination } from "../../../shared/domain/crud.repository";
/** Persists custom roles while protecting system roles, assignments and outstanding invitations. */
@Injectable()
export class SqlRolesRepository extends RolesRepository {
  /**
   * Recibe las dependencias de la operación.
   * @param db Dependencia tipada de db.
   * @param authorization Dependencia tipada de authorization.
   */
  constructor(
    private readonly db: Sequelize,
    private readonly authorization: AuthorizationStore
  ) {
    super();
  }
  /**
   *
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  async read(id: string) {
    const rows = await this.db.query<Omit<RoleView, "permissions">>(
      'SELECT id,name,description,"isProtected" FROM roles WHERE id = :id',
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    return rows.length ? { ...rows[0], permissions: await this.authorization.permissionsFor([rows[0].name]) } : null;
  }
  /**
   *
   * @param page Bounded pagination settings.
   * @returns Result of the completed operation.
   */
  async list(page: Pagination) {
    const rows = await this.db.query<{ id: string }>("SELECT id FROM roles ORDER BY name LIMIT :limit OFFSET :offset", {
      replacements: { ...page },
      type: QueryTypes.SELECT
    });
    const counts = await this.db.query<{ total: number }>("SELECT COUNT(*)::int AS total FROM roles", {
      type: QueryTypes.SELECT
    });
    return {
      items: (await Promise.all(rows.map(row => this.read(row.id)))).filter((row): row is RoleView => row !== null),
      total: counts[0].total
    };
  }
  /**
   *
   * @returns Result of the completed operation.
   */
  async catalog() {
    return [...REGISTERED_PERMISSIONS];
  }
  /**
   * Filters clinic role options using the same transactional delegation checks as assignment.
   * @param clinicId Target clinic.
   * @param actor Current inviter.
   * @returns Roles that can be assigned in that clinic.
   */
  async clinicAssignable(clinicId: string, actor: AccessActor) {
    return this.db.transaction(async transaction => {
      const rows = await this.db.query<{ id: string; name: string }>(
        "SELECT id,name FROM roles WHERE name NOT IN ('customer','staff','superadmin') AND name NOT LIKE 'legacy-%' ORDER BY name",
        { type: QueryTypes.SELECT, transaction }
      );
      const allowed: RoleView[] = [];
      for (const row of rows) {
        try {
          await this.authorization.assertClinicAssignable([{ clinicId, roles: [row.name] }], actor, transaction);
        } catch (error) {
          if (error instanceof ForbiddenException) continue;
          throw error;
        }
        const role = await this.read(row.id);
        if (role) allowed.push(role);
      }
      return allowed;
    });
  }
  /**
   *
   * @param names Requested role names.
   * @param actor Authenticated caller and current effective grants.
   */
  async authorizeAssignment(names: string[], actor: AccessActor) {
    await this.db.transaction(transaction => this.authorization.assertAssignable(names, actor, transaction));
  }
  /**
   *
   * @param input Validated definition for this operation.
   * @param actor Authenticated caller and current effective grants.
   */
  private validate(input: RoleInput, actor: AccessActor) {
    if (
      !/^[a-z][a-z0-9-]{1,59}$/.test(input.name) ||
      input.name.startsWith("legacy-") ||
      ["superadmin", "admin", "customer", "staff"].includes(input.name)
    )
      throw new BadRequestException("El nombre del rol está reservado o no es válido");
    if (
      !input.description.trim() ||
      input.description.length > 255 ||
      input.permissions.length > 200 ||
      new Set(input.permissions).size !== input.permissions.length
    )
      throw new BadRequestException("La definición del rol no es válida");
    const catalog = new Set<string>(REGISTERED_PERMISSIONS.map(p => p.shortcode));
    if (input.permissions.some(code => !catalog.has(code))) throw new BadRequestException("El permiso no existe");
    if (!AccessPolicy.delegates(actor, input.permissions))
      throw new ForbiddenException("No puede delegar permisos que usted no posee");
  }
  /**
   *
   * @param id Resource identifier.
   * @param input Validated definition for this operation.
   * @param transaction Current database transaction.
   * @returns Result of the completed operation.
   */
  private async grants(id: string, input: RoleInput, transaction: Transaction) {
    await this.db.query('DELETE FROM role_permissions WHERE "roleId" = :id', { replacements: { id }, transaction });
    for (const code of input.permissions)
      await this.db.query('INSERT INTO role_permissions ("roleId","permissionCode") VALUES (:id,:code)', {
        replacements: { id, code },
        transaction
      });
  }
  /**
   *
   * @param input Validated definition for this operation.
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  async create(input: RoleInput, actor: AccessActor) {
    this.validate(input, actor);
    const id = randomUUID();
    try {
      await this.db.transaction(async transaction => {
        await this.db.query(
          'INSERT INTO roles (id,name,description,"isProtected") VALUES (:id,:name,:description,false)',
          { replacements: { id, name: input.name, description: input.description.trim() }, transaction }
        );
        await this.grants(id, input, transaction);
        await recordChange(
          this.db,
          transaction,
          roleChange("role.created", id, actor.id, null, {
            id,
            name: input.name,
            description: input.description.trim(),
            isProtected: false,
            permissions: input.permissions
          })
        );
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw new ConflictException("El rol ya existe");
      throw error;
    }
    return (await this.read(id))!;
  }
  /**
   *
   * @param id Resource identifier.
   * @param actor Authenticated caller and current effective grants.
   * @param transaction Current database transaction.
   * @returns Result of the completed operation.
   */
  private async editable(id: string, actor: AccessActor, transaction: Transaction) {
    const [row] = await this.db.query<Omit<RoleView, "permissions">>(
      'SELECT id,name,description,"isProtected" FROM roles WHERE id = :id FOR UPDATE',
      { replacements: { id }, transaction, type: QueryTypes.SELECT }
    );
    if (!row) throw new NotFoundException("No se encontró el rol");
    if (row.isProtected) throw new ForbiddenException("Los roles del sistema se administran mediante la configuración");
    if (!AccessPolicy.delegates(actor, await this.authorization.permissionsFor([row.name], transaction)))
      throw new ForbiddenException("El rol contiene permisos que usted no posee");
    return row;
  }
  /**
   *
   * @param id Resource identifier.
   * @param input Validated definition for this operation.
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  async update(id: string, input: RoleInput, actor: AccessActor) {
    await this.db.transaction(async transaction => {
      const role = await this.editable(id, actor, transaction);
      this.validate(input, actor);
      const before = { ...role, permissions: await this.authorization.permissionsFor([role.name], transaction) };
      if (input.name !== role.name)
        throw new BadRequestException(
          "El nombre del rol no se puede cambiar; puede actualizar su descripción o sus permisos"
        );
      await this.db.query("UPDATE roles SET description = :description WHERE id = :id", {
        replacements: { id, description: input.description.trim() },
        transaction
      });
      await this.grants(id, input, transaction);
      const recipients = await this.db.query<{ userId: string }>('SELECT "userId" FROM user_roles WHERE "roleId"=:id', {
        replacements: { id },
        transaction,
        type: QueryTypes.SELECT
      });
      await recordChange(
        this.db,
        transaction,
        roleChange(
          "role.updated",
          id,
          actor.id,
          before,
          { ...role, description: input.description.trim(), permissions: input.permissions },
          recipients.map(row => row.userId)
        )
      );
    });
    return (await this.read(id))!;
  }
  /**
   *
   * @param id Resource identifier.
   * @param actor Authenticated caller and current effective grants.
   */
  async delete(id: string, actor: AccessActor) {
    await this.db.transaction(async transaction => {
      const role = await this.editable(id, actor, transaction);
      const [usage] = await this.db.query<{ used: boolean }>(
        `SELECT EXISTS(SELECT 1
 FROM user_roles
 WHERE "roleId" = :id)

 OR EXISTS(SELECT 1
 FROM invitations
 WHERE status = 'pending'
 AND "expiresAt" > NOW()
 AND (:name = ANY(roles)
 OR EXISTS(SELECT 1
 FROM jsonb_array_elements("clinicAssignments") a
 WHERE (a->'roles') @> jsonb_build_array(CAST(:name AS TEXT)))) ) AS used`,
        { replacements: { id, name: role.name }, transaction, type: QueryTypes.SELECT }
      );
      if (usage.used) throw new ConflictException("El rol está asignado o reservado por una invitación vigente");
      await recordChange(
        this.db,
        transaction,
        roleChange(
          "role.deleted",
          id,
          actor.id,
          { ...role, permissions: await this.authorization.permissionsFor([role.name], transaction) },
          null
        )
      );
      await this.db.query("DELETE FROM roles WHERE id = :id", { replacements: { id }, transaction });
    });
  }
}
