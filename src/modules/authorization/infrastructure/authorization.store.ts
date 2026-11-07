import { PermissionCode } from "../../../shared/domain/permission-code";
import type { ClinicRoleAssignment } from "../domain/clinic-context.repository";
import { recordChange } from "../../audit/infrastructure/record-change";
import { Injectable, BadRequestException, ForbiddenException } from "@nestjs/common";
import { AccessPolicy, type AccessActor } from "../domain/access-policy";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, type Transaction } from "sequelize";
import type { Permission } from "../../../shared/domain/permission";
/**
 * Resolves current role grants from the relational authorization tables.
 */
@Injectable()
export class AuthorizationStore {
  /**
   * Checks role existence and delegation while locking definitions against concurrent edits.
   * @param names Requested role names.
   * @param actor Authenticated caller and current effective grants.
   * @param transaction Current database transaction.
   * @returns Result of the completed operation.
   */
  async assertAssignable(names: string[], actor: AccessActor, transaction: Transaction): Promise<void> {
    if (!AccessPolicy.allows(actor, PermissionCode.RolesAssign))
      throw new ForbiddenException("No tiene permiso para asignar roles");
    const unique = [...new Set(names)];
    if (unique.some(name => name.startsWith("legacy-")))
      throw new BadRequestException("Los roles heredados no pueden asignarse nuevamente");
    if (unique.includes("superadmin") && !actor.roles.includes("superadmin"))
      throw new ForbiddenException("Solo un superadministrador puede asignar el rol de superadministrador");
    if (!unique.length) return;
    const rows = await this.db.query<{ name: string }>(
      "SELECT name FROM roles WHERE name IN (:names) ORDER BY name FOR SHARE",
      { replacements: { names: unique }, transaction, type: QueryTypes.SELECT }
    );
    if (rows.length !== unique.length) throw new BadRequestException("El rol no existe");
    if (
      actor.globalPermissions &&
      unique.some(name => name !== "customer") &&
      !AccessPolicy.delegates(
        { ...actor, roles: actor.globalRoles ?? [], permissions: actor.globalPermissions },
        await this.permissionsFor(unique, transaction)
      )
    )
      throw new ForbiddenException("Los permisos de clínica no permiten asignar roles globales");
    if (!AccessPolicy.delegates(actor, await this.permissionsFor(unique, transaction)))
      throw new ForbiddenException("No puede asignar roles con permisos que usted no posee");
  }
  /**
   * Resolves the current verified inviter before redeeming mutable custom role grants.
   * @param id Resource identifier.
   * @param transaction Current database transaction.
   * @returns Result of the completed operation.
   */
  async actorFor(id: string, transaction: Transaction): Promise<AccessActor> {
    const [user] = await this.db.query<{ id: string }>(
      "SELECT id FROM users WHERE id = :id AND enabled = true AND verified = true",
      { replacements: { id }, transaction, type: QueryTypes.SELECT }
    );
    if (!user) throw new ForbiddenException("El invitador ya no cumple los requisitos de acceso");
    const roles = await this.rolesFor(id, transaction);
    const globalPermissions = await this.permissionsFor(roles, transaction);
    const [row] = await this.db.query<{ permissions: Permission[] }>(
      'SELECT COALESCE(ARRAY_AGG(DISTINCT rp."permissionCode"),\'{}\') AS permissions FROM user_roles ur JOIN role_permissions rp ON rp."roleId"=ur."roleId" WHERE ur."userId"=:id',
      { replacements: { id }, transaction, type: QueryTypes.SELECT }
    );
    return { id, roles, permissions: row.permissions, globalPermissions, globalRoles: roles };
  }
  /**
   * Recibe las dependencias de la operación.
   * @param db Dependencia tipada de db.
   */
  constructor(private readonly db: Sequelize) {}
  /**
   * Reads role names assigned to a user.
   * @param userId User identifier.
   * @param transaction Optional transaction.
   * @returns Assigned role names.
   */
  async rolesFor(userId: string, transaction?: Transaction): Promise<string[]> {
    const rows = await this.db.query<{ name: string }>(
      'SELECT r.name FROM roles r JOIN "user_roles" ur ON ur."roleId" = r.id WHERE ur."userId" = :userId AND ur."clinicId" IS NULL ORDER BY r.name',
      { replacements: { userId }, type: QueryTypes.SELECT, transaction }
    );
    return rows.map(row => row.name);
  }
  /**
   * Resolves the unique union of role grants.
   * @param roles Assigned role names.
   * @param transaction Optional transaction.
   * @returns Effective permission shortcodes.
   */
  async permissionsFor(roles: string[], transaction?: Transaction): Promise<Permission[]> {
    if (!roles.length) return [];
    const rows = await this.db.query<{ shortcode: Permission }>(
      'SELECT DISTINCT p.shortcode FROM permissions p JOIN "role_permissions" rp ON rp."permissionCode" = p.shortcode JOIN roles r ON r.id = rp."roleId" WHERE r.name IN (:roles) ORDER BY p.shortcode',
      { replacements: { roles }, type: QueryTypes.SELECT, transaction }
    );
    return rows.map(row => row.shortcode);
  }
  /**
   * Replaces a user membership atomically with its resource write.
   * @param userId User identifier.
   * @param names Desired role names.
   * @param transaction Resource transaction.
   */
  async setRoles(userId: string, names: string[], transaction: Transaction): Promise<void> {
    const unique = [...new Set(names)];
    const roles = unique.length
      ? await this.db.query<{ id: string }>("SELECT id FROM roles WHERE name IN (:names)", {
          replacements: { names: unique },
          type: QueryTypes.SELECT,
          transaction
        })
      : [];
    if (roles.length !== unique.length)
      throw new BadRequestException("El rol no existe; primero sincronice el catálogo de permisos");
    await this.db.query('DELETE FROM "user_roles" WHERE "userId" = :userId AND "clinicId" IS NULL', {
      replacements: { userId },
      transaction
    });
    for (const role of roles)
      await this.db.query('INSERT INTO "user_roles" ("userId", "roleId") VALUES (:userId, :roleId)', {
        replacements: { userId, roleId: role.id },
        transaction
      });
  }
  /**
   * Revalidates delegation for each concrete clinic; global names never substitute clinic membership.
   * @param assignments Clinics and their explicit role names.
   * @param actor Authenticated caller and current role grants.
   * @param transaction Current resource transaction.
   */
  async assertClinicAssignable(assignments: ClinicRoleAssignment[], actor: AccessActor, transaction: Transaction) {
    if (new Set(assignments.map(a => a.clinicId)).size !== assignments.length)
      throw new BadRequestException("La asignación de clínica está duplicada");
    for (const assignment of [...assignments].sort((a, b) => a.clinicId.localeCompare(b.clinicId))) {
      if (!assignment.roles.length || assignment.roles.includes("superadmin"))
        throw new BadRequestException(
          "Seleccione roles de clínica; el superadministrador es exclusivo de la plataforma"
        );
      const [clinic] = await this.db.query<{ id: string }>(
        "SELECT id FROM clinics WHERE id=:id AND enabled FOR UPDATE",
        { replacements: { id: assignment.clinicId }, transaction, type: QueryTypes.SELECT }
      );
      if (!clinic) throw new BadRequestException("La clínica no está disponible");
      const globalRoles = await this.rolesFor(actor.id, transaction),
        globalPermissions = await this.permissionsFor(globalRoles, transaction);
      const [access] = await this.db.query<{ allowed: boolean }>(
        "SELECT blue_care_clinic_allowed(:actorId,CAST(:id AS UUID),CAST(:selected AS UUID),'clinics:staff-manage') AS allowed",
        {
          replacements: { actorId: actor.id, id: assignment.clinicId, selected: actor.clinicId ?? null },
          transaction,
          type: QueryTypes.SELECT
        }
      );
      if (
        !(
          globalPermissions.includes(PermissionCode.ClinicsStaffManage) &&
          globalPermissions.includes(PermissionCode.ClinicsAll)
        ) &&
        !access.allowed
      )
        throw new ForbiddenException("No tiene autorización para gestionar colaboradores en esta clínica");
      const current = await this.db.query<{ name: string }>(
        'SELECT DISTINCT r.name FROM user_roles ur JOIN roles r ON r.id=ur."roleId" WHERE ur."userId"=:id AND (ur."clinicId" IS NULL OR ur."clinicId"=:clinicId)',
        { replacements: { id: actor.id, clinicId: assignment.clinicId }, transaction, type: QueryTypes.SELECT }
      );
      const permissions = await this.permissionsFor(
        current.map(r => r.name),
        transaction
      );
      await this.assertAssignable(
        assignment.roles,
        { ...actor, roles: globalRoles, permissions, globalPermissions: undefined },
        transaction
      );
    }
  }
  /**
   * Replaces roles for one clinic while preserving every other clinic and global assignment.
   * @param userId Target account identifier.
   * @param assignment Clinic and its explicit role names.
   * @param actor Authenticated caller and current role grants.
   * @param transaction Current resource transaction.
   */
  async assignClinic(userId: string, assignment: ClinicRoleAssignment, actor: AccessActor, transaction: Transaction) {
    await this.assertClinicAssignable([assignment], actor, transaction);
    const [clinic] = await this.db.query<{ name: string }>("SELECT name FROM clinics WHERE id=:id FOR UPDATE", {
      replacements: { id: assignment.clinicId },
      transaction,
      type: QueryTypes.SELECT
    });
    const before = await this.db.query<{ name: string }>(
      'SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur."roleId" WHERE ur."userId"=:userId AND ur."clinicId"=:clinicId ORDER BY r.name',
      { replacements: { userId, clinicId: assignment.clinicId }, transaction, type: QueryTypes.SELECT }
    );
    const [exists] = await this.db.query<{ id: string }>(
      'SELECT "userId" AS id FROM clinic_staff WHERE "userId"=:userId AND "clinicId"=:clinicId',
      { replacements: { userId, clinicId: assignment.clinicId }, transaction, type: QueryTypes.SELECT }
    );
    const names = [...new Set(assignment.roles)].sort();
    await this.db.query(
      'INSERT INTO staff_profiles("userId","createdAt") VALUES (:userId,NOW()) ON CONFLICT DO NOTHING',
      { replacements: { userId }, transaction }
    );
    if (exists && JSON.stringify(before.map(r => r.name)) === JSON.stringify(names)) return;
    await this.db.query(
      'INSERT INTO clinic_staff("clinicId","userId","createdAt") VALUES (:clinicId,:userId,NOW()) ON CONFLICT DO NOTHING',
      { replacements: { userId, clinicId: assignment.clinicId }, transaction }
    );
    await this.db.query('DELETE FROM user_roles WHERE "userId"=:userId AND "clinicId"=:clinicId', {
      replacements: { userId, clinicId: assignment.clinicId },
      transaction
    });
    for (const name of names)
      await this.db.query(
        'INSERT INTO user_roles("userId","roleId","clinicId") SELECT :userId,id,:clinicId FROM roles WHERE name=:name',
        { replacements: { userId, clinicId: assignment.clinicId, name }, transaction }
      );
    await recordChange(this.db, transaction, {
      action: exists ? "clinic.staff-roles-changed" : "clinic.staff-assigned",
      resourceType: "clinic",
      resourceId: assignment.clinicId,
      actorId: actor.id,
      before: { userId, roles: before.map(r => r.name) },
      after: { userId, roles: names },
      notifications: [
        {
          userId,
          title: exists ? "Se actualizó tu acceso a una clínica" : "Acceso a una clínica",
          body:
            (exists ? "Se actualizaron tus permisos en " : "Ya tienes acceso a ") +
            clinic.name +
            ". Consulta tus clínicas disponibles en Blue Care.",
          email: true,
          push: true
        }
      ]
    });
  }
}
