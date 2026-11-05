import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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
   *
   * @param db PostgreSQL connection.
   * @param access Current clinic assignment resolver.
   */
  constructor(
    private readonly db: Sequelize,
    private readonly access: ClinicAccess
  ) {
    super();
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
      if (error instanceof UniqueConstraintError) throw new ConflictException("Clinic code already exists");
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
    const filter = `WHERE (:all OR EXISTS(SELECT 1 FROM clinic_staff s WHERE s."clinicId"=c.id AND s."userId"=:actorId))
      AND (:enabled IS NULL OR c.enabled=:enabled) AND (:search IS NULL OR c.name ILIKE :search ESCAPE '!' OR c.code ILIKE :search ESCAPE '!')`;
    const replacements = {
      ...query,
      all: actor.permissions.includes("clinics:all"),
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
        if (!before) throw new NotFoundException("Clinic not found");
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
      if (error instanceof UniqueConstraintError) throw new ConflictException("Clinic code already exists");
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
    await this.access.require(id, actor);
    const replacements = { id, ...page };
    const items = await this.db.query<ClinicStaffView>(
      'SELECT * FROM clinic_staff WHERE "clinicId"=:id ORDER BY "userId" LIMIT :limit OFFSET :offset',
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
   * @returns The persisted result or completion of the authorized operation.
   */
  async assign(id: string, userId: string, actor: AccessActor) {
    await this.assignment(id, userId, actor, true);
  }
  /**
   * Removes a clinic assignment using explicit global authority.
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async unassign(id: string, userId: string, actor: AccessActor) {
    await this.assignment(id, userId, actor, false);
  }
  /**
   * Changes a staff assignment and records its audit event atomically.
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param actor Authenticated identity and current permissions.
   * @param assign Whether to grant or remove the assignment.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async assignment(id: string, userId: string, actor: AccessActor, assign: boolean) {
    if (!actor.permissions.includes("clinics:all") || !actor.permissions.includes("clinics:staff-manage"))
      throw new ForbiddenException("Global staff management permission required");
    await this.db.transaction(async transaction => {
      await this.lockClinic(id, transaction);
      const [user] = await this.db.query<{ id: string }>("SELECT id FROM users WHERE id=:userId FOR KEY SHARE", {
        replacements: { userId },
        transaction,
        type: QueryTypes.SELECT
      });
      if (!user) throw new NotFoundException("User not found");
      const [existing] = await this.db.query<ClinicStaffView>(
        'SELECT * FROM clinic_staff WHERE "clinicId"=:id AND "userId"=:userId',
        { replacements: { id, userId }, transaction, type: QueryTypes.SELECT }
      );
      if (!!existing === assign) return;
      const value = { clinicId: id, userId };
      if (assign)
        await this.db.query('INSERT INTO clinic_staff ("clinicId","userId","createdAt") VALUES (:id,:userId,NOW())', {
          replacements: { id, userId },
          transaction
        });
      else
        await this.db.query('DELETE FROM clinic_staff WHERE "clinicId"=:id AND "userId"=:userId', {
          replacements: { id, userId },
          transaction
        });
      await recordChange(
        this.db,
        transaction,
        clinicChange(
          assign ? "clinic.staff-assigned" : "clinic.staff-unassigned",
          id,
          actor.id,
          existing ?? null,
          assign ? value : null
        )
      );
    });
  }
  /**
   * Locks an existing clinic before modifying its assignments.
   * @param id Resource identifier.
   * @param transaction Transaction containing the resource mutation.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async lockClinic(id: string, transaction: Transaction) {
    const [row] = await this.db.query<{ id: string }>("SELECT id FROM clinics WHERE id=:id FOR UPDATE", {
      replacements: { id },
      transaction,
      type: QueryTypes.SELECT
    });
    if (!row) throw new NotFoundException("Clinic not found");
  }
}
