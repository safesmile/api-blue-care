import { PermissionCode } from "../../../shared/domain/permission-code";
import { AuthorizationStore } from "../../authorization/infrastructure/authorization.store";
import { clinicScopeParams } from "../../clinics/infrastructure/clinic-scope";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, UniqueConstraintError, type Transaction } from "sequelize";
import { randomUUID } from "node:crypto";
import {
  ClinicRepository,
  type ClinicInput,
  type ClinicView,
  type ClinicQuery,
  type ClinicStaffView
} from "../domain/clinic.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { ClinicAccess } from "./clinic-access";
import { recordChange } from "../../audit/infrastructure/record-change";
import { clinicChange } from "../domain/clinic.events";
/** Persists clinic catalog and access grants with their audit records. */
@Injectable()
export class SqlClinicRepository extends ClinicRepository {
  /**
   * Recibe las dependencias de la operación.
   * @param db Dependencia tipada de db.
   * @param access Dependencia tipada de access.
   * @param authorization Dependencia tipada de authorization.
   */
  constructor(
    private readonly db: Sequelize,
    private readonly access: ClinicAccess,
    private readonly authorization: AuthorizationStore
  ) {
    super();
  }
  /**
   * Lists assignable clinic metadata without bypassing clinical record scope.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and current role grants.
   * @returns The authorized result or completion of the operation.
   */
  async available(query: ClinicQuery, actor: AccessActor) {
    const grants = actor.globalPermissions ?? actor.permissions;
    const global = grants.includes(PermissionCode.ClinicsStaffManage) && grants.includes(PermissionCode.ClinicsAll);
    const scope = global
      ? "WHERE TRUE"
      : "WHERE blue_care_clinic_allowed(:actorId,c.id,CAST(:currentClinicId AS UUID),'clinics:staff-manage')";
    const where =
      scope +
      " AND (:enabled IS NULL OR c.enabled=:enabled) AND (:search IS NULL OR c.name ILIKE :search ESCAPE '!' OR c.code ILIKE :search ESCAPE '!')";
    const replacements = {
      ...query,
      ...clinicScopeParams(actor),
      enabled: query.enabled ?? true,
      search: query.search === undefined ? null : "%" + query.search.replace(/[!%_]/g, "!$&") + "%"
    };
    const items = await this.db.query<ClinicView>(
      "SELECT c.* FROM clinics c " + where + " ORDER BY c.name,c.id LIMIT :limit OFFSET :offset",
      { replacements, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>("SELECT COUNT(*)::int total FROM clinics c " + where, {
      replacements,
      type: QueryTypes.SELECT
    });
    return { items, total: count.total };
  }
  /**
   * Creates an independent administrative record.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async create(input: ClinicInput, actor: AccessActor) {
    const id = randomUUID();
    try {
      return await this.db.transaction(async transaction => {
        const [row] = await this.db.query<ClinicView>(
          `INSERT INTO clinics (id,code,name,address,phone,email,enabled,"createdAt","updatedAt")
           VALUES (:id,:code,:name,:address,:phone,:email,true,NOW(),NOW()) RETURNING *`,
          {
            replacements: {
              ...input,
              id,
              address: input.address ?? null,
              phone: input.phone ?? null,
              email: input.email ?? null
            },
            transaction,
            type: QueryTypes.SELECT
          }
        );
        await recordChange(this.db, transaction, clinicChange("clinic.created", id, actor.id, null, row));
        return row;
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw new ConflictException("El código de la clínica ya existe");
      throw error;
    }
  }
  /**
   * Reads a resource within the authorized scope.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async read(id: string, actor: AccessActor) {
    await this.access.require(id, actor);
    const [row] = await this.db.query<ClinicView>("SELECT * FROM clinics WHERE id=:id", {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    return row ?? null;
  }
  /**
   * Returns a bounded page within the authorized scope.
   * @param query Bounded search and status filters.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async list(query: ClinicQuery, actor: AccessActor) {
    const filter = `WHERE blue_care_clinic_allowed(:actorId,c.id,CAST(:currentClinicId AS UUID),CAST(:clinicPermission AS TEXT))
      AND (:enabled IS NULL OR c.enabled=:enabled) AND (:search IS NULL OR c.name ILIKE :search ESCAPE '!' OR c.code ILIKE :search ESCAPE '!')`;
    const replacements = {
      ...query,
      ...clinicScopeParams(actor),
      actorId: actor.id,
      enabled: query.enabled ?? null,
      search: query.search === undefined ? null : "%" + query.search.replace(/[!%_]/g, "!$&") + "%"
    };
    const items = await this.db.query<ClinicView>(
      "SELECT c.* FROM clinics c " + filter + " ORDER BY c.name,c.id LIMIT :limit OFFSET :offset",
      { replacements, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>("SELECT COUNT(*)::int total FROM clinics c " + filter, {
      replacements,
      type: QueryTypes.SELECT
    });
    return { items, total: count.total };
  }
  /**
   * Updates only allowed administrative fields.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async update(id: string, input: Partial<ClinicInput> & { enabled?: boolean }, actor: AccessActor) {
    try {
      return await this.db.transaction(async transaction => {
        // Lock the catalog row before checking its grants to serialize assignment changes.
        const [before] = await this.db.query<ClinicView>("SELECT * FROM clinics WHERE id=:id FOR UPDATE", {
          replacements: { id },
          transaction,
          type: QueryTypes.SELECT
        });
        if (!before) throw new NotFoundException("No se encontró la clínica");
        await this.access.require(id, actor, transaction);
        const next = { ...before };
        for (const field of ["code", "name", "address", "phone", "email", "enabled"] as const)
          if (input[field] !== undefined) Object.assign(next, { [field]: input[field] });
        const [after] = await this.db.query<ClinicView>(
          'UPDATE clinics SET code=:code,name=:name,address=:address,phone=:phone,email=:email,enabled=:enabled,"updatedAt"=NOW() WHERE id=:id RETURNING *',
          { replacements: { ...next }, transaction, type: QueryTypes.SELECT }
        );
        await recordChange(this.db, transaction, clinicChange("clinic.updated", id, actor.id, before, after));
        return after;
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw new ConflictException("El código de la clínica ya existe");
      throw error;
    }
  }
  /**
   * Lists bounded staff assignments for the clinic.
   * @param id Resource identifier.
   * @param page Bounded pagination.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async staff(id: string, page: Pagination, actor: AccessActor) {
    const global = actor.globalPermissions ?? actor.permissions;
    if (!(global.includes(PermissionCode.ClinicsStaffList) && global.includes(PermissionCode.ClinicsAll)))
      await this.access.require(id, actor);
    const replacements = { id, ...page };
    const items = await this.db.query<ClinicStaffView>(
      `SELECT s.*,u.name,u.email,COALESCE((SELECT ARRAY_AGG(r.name
 ORDER BY r.name)
 FROM user_roles ur
 JOIN roles r
 ON r.id=ur."roleId"
 WHERE ur."userId"=s."userId"
 AND ur."clinicId"=s."clinicId"),'{}') AS roles
 FROM clinic_staff s
 JOIN users u
 ON u.id=s."userId"
 WHERE s."clinicId"=:id
 ORDER BY s."userId" LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>(
      'SELECT COUNT(*)::int total FROM clinic_staff WHERE "clinicId"=:id',
      { replacements, type: QueryTypes.SELECT }
    );
    return { items, total: count.total };
  }
  /**
   * Grants a clinic assignment using explicit global authority.
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param actor Authenticated identity and current permissions.
   * @param roles Role names for this clinic assignment.
   * @returns The persisted result or completion of the authorized operation.
   */
  async assign(id: string, userId: string, actor: AccessActor, roles: string[]) {
    await this.db.transaction(async transaction => {
      await this.authorization.assignClinic(userId, { clinicId: id, roles }, actor, transaction);
    });
  }
  /**
   * Removes a clinic assignment using explicit global authority.
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async unassign(id: string, userId: string, actor: AccessActor) {
    await this.removeAssignment(id, userId, actor);
  }
  /**
   * Changes a staff assignment and records its audit event atomically.
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async removeAssignment(id: string, userId: string, actor: AccessActor) {
    await this.db.transaction(async transaction => {
      const clinic = await this.lockClinic(id, transaction);
      const globalRoles = await this.authorization.rolesFor(actor.id, transaction);
      const grants = await this.authorization.permissionsFor(globalRoles, transaction);
      if (!(grants.includes(PermissionCode.ClinicsStaffManage) && grants.includes(PermissionCode.ClinicsAll)))
        await this.access.require(id, { ...actor, clinicPermission: PermissionCode.ClinicsStaffManage }, transaction);
      const [user] = await this.db.query<{ id: string }>("SELECT id FROM users WHERE id=:userId FOR KEY SHARE", {
        replacements: { userId },
        transaction,
        type: QueryTypes.SELECT
      });
      if (!user) throw new NotFoundException("No se encontró el usuario");
      const [existing] = await this.db.query<ClinicStaffView>(
        'SELECT * FROM clinic_staff WHERE "clinicId"=:id AND "userId"=:userId',
        { replacements: { id, userId }, transaction, type: QueryTypes.SELECT }
      );
      if (!existing) return;
      await this.db.query('DELETE FROM user_roles WHERE "clinicId"=:id AND "userId"=:userId', {
        replacements: { id, userId },
        transaction
      });
      await this.db.query('DELETE FROM clinic_staff WHERE "clinicId"=:id AND "userId"=:userId', {
        replacements: { id, userId },
        transaction
      });
      await recordChange(this.db, transaction, {
        ...clinicChange("clinic.staff-unassigned", id, actor.id, existing, null),
        notifications: [
          {
            userId,
            title: "Se retiró tu acceso a una clínica",
            body: "Se retiró tu acceso a " + clinic.name + ". Actualiza tus clínicas disponibles en Blue Care.",
            email: true,
            push: true
          }
        ]
      });
    });
  }
  /**
   * Locks an existing clinic before modifying its assignments.
   * @param id Resource identifier.
   * @param transaction Transaction containing the resource mutation.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async lockClinic(id: string, transaction: Transaction) {
    const [row] = await this.db.query<{ id: string; name: string }>(
      "SELECT id,name FROM clinics WHERE id=:id FOR UPDATE",
      {
        replacements: { id },
        transaction,
        type: QueryTypes.SELECT
      }
    );
    if (!row) throw new NotFoundException("No se encontró la clínica");
    return row;
  }
}
