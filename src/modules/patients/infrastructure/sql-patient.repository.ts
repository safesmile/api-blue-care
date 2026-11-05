import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException
} from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, UniqueConstraintError, type Transaction } from "sequelize";
import { randomUUID } from "node:crypto";
import {
  PatientRepository,
  type PatientInput,
  type PatientView,
  type PatientQuery
} from "../domain/patient.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import { ClinicAccess } from "../../clinics/infrastructure/clinic-access";
import { recordChange } from "../../audit/infrastructure/record-change";
import { patientChange } from "../domain/patient.events";
import { linkPatientAccount } from "./patient-account-link";
const SCOPE = `(:all OR EXISTS(SELECT 1 FROM patient_clinics pc JOIN clinics c ON c.id=pc."clinicId" AND c.enabled
 JOIN clinic_staff s ON s."clinicId"=pc."clinicId" WHERE pc."patientId"=p.id AND s."userId"=:actorId))`;
/** Persists shared patient records with scoped access and explicit one-to-one account binding. */
@Injectable()
export class SqlPatientRepository extends PatientRepository {
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
  async create(input: PatientInput & { clinicId: string }, actor: AccessActor) {
    return this.conflicts(() =>
      this.db.transaction(async transaction => {
        await this.access.require(input.clinicId, actor, transaction, true);
        const id = randomUUID();
        const [row] = await this.db.query<PatientView>(
          `INSERT INTO patients (id,"firstName","lastName",email,phone,dpi,"birthDate",address,enabled,"createdAt","updatedAt")
        VALUES (:id,:firstName,:lastName,:email,:phone,:dpi,:birthDate,:address,true,NOW(),NOW()) RETURNING *`,
          {
            replacements: {
              ...input,
              id,
              email: input.email ?? null,
              phone: input.phone ?? null,
              dpi: input.dpi ?? null,
              birthDate: input.birthDate ?? null,
              address: input.address ?? null
            },
            transaction,
            type: QueryTypes.SELECT
          }
        );
        await this.db.query(
          'INSERT INTO patient_clinics ("patientId","clinicId","createdAt") VALUES (:id,:clinicId,NOW())',
          { replacements: { id, clinicId: input.clinicId }, transaction }
        );
        await recordChange(
          this.db,
          transaction,
          patientChange("patient.created", id, actor.id, null, { ...row, clinicId: input.clinicId })
        );
        return row;
      })
    );
  }
  /**
   * Reads a resource within the authorized scope.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async read(id: string, actor: AccessActor) {
    const [row] = await this.db.query<PatientView>("SELECT p.* FROM patients p WHERE p.id=:id AND " + SCOPE, {
      replacements: { id, all: actor.permissions.includes("clinics:all"), actorId: actor.id },
      type: QueryTypes.SELECT
    });
    return row ?? null;
  }
  /**
   * Reads the patient bound to the authenticated account.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @returns The persisted result or completion of the authorized operation.
   */
  async own(userId: string) {
    const [row] = await this.db.query<PatientView>('SELECT * FROM patients WHERE "userId"=:userId', {
      replacements: { userId },
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
  async list(query: PatientQuery, actor: AccessActor) {
    if (query.clinicId) await this.access.require(query.clinicId, actor);
    const filter =
      "WHERE " +
      SCOPE +
      ` AND (:enabled IS NULL OR p.enabled=:enabled)
      AND (:clinicId IS NULL OR EXISTS(SELECT 1 FROM patient_clinics pc WHERE pc."patientId"=p.id AND pc."clinicId"=:clinicId))
      AND (:search IS NULL OR (p."firstName" || ' ' || p."lastName") ILIKE :search ESCAPE '!' OR p.email ILIKE :search ESCAPE '!' OR p.phone ILIKE :search ESCAPE '!')`;
    const replacements = {
      ...query,
      all: actor.permissions.includes("clinics:all"),
      actorId: actor.id,
      enabled: query.enabled ?? null,
      clinicId: query.clinicId ?? null,
      search: query.search === undefined ? null : "%" + query.search.replace(/[!%_]/g, "!$&") + "%"
    };
    const items = await this.db.query<PatientView>(
      "SELECT p.* FROM patients p " + filter + ' ORDER BY p."lastName",p."firstName",p.id LIMIT :limit OFFSET :offset',
      { replacements, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>("SELECT COUNT(*)::int total FROM patients p " + filter, {
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
  async update(id: string, input: Partial<PatientInput> & { enabled?: boolean }, actor: AccessActor) {
    return this.conflicts(() =>
      this.db.transaction(async transaction => {
        const before = await this.lock(id, transaction);
        await this.requireScope(before.id, actor, transaction);
        return this.save(before, input, actor, transaction);
      })
    );
  }
  /**
   * Updates permitted profile fields of the authenticated patient.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async updateOwn(userId: string, input: Pick<PatientInput, "phone" | "birthDate" | "address">, actor: AccessActor) {
    if (userId !== actor.id || !actor.permissions.includes("patients:self"))
      throw new ForbiddenException("Own patient only");
    return this.db.transaction(async transaction => {
      const [before] = await this.db.query<PatientView>('SELECT * FROM patients WHERE "userId"=:userId FOR UPDATE', {
        replacements: { userId },
        transaction,
        type: QueryTypes.SELECT
      });
      if (!before) throw new NotFoundException("No linked patient");
      return this.save(
        before,
        { phone: input.phone, birthDate: input.birthDate, address: input.address },
        actor,
        transaction
      );
    });
  }
  /**
   * Binds a patient only to a verified matching account.
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async link(id: string, userId: string, actor: AccessActor) {
    return this.conflicts(() =>
      this.db.transaction(async transaction => {
        await this.lock(id, transaction);
        await this.requireScope(id, actor, transaction);
        return linkPatientAccount(this.db, transaction, id, userId, actor.id);
      })
    );
  }
  /**
   * Adds an authorized clinic association without duplicating the patient.
   * @param id Resource identifier.
   * @param clinicId Clinic identifier.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async associate(id: string, clinicId: string, actor: AccessActor) {
    if (!actor.permissions.includes("clinics:all")) throw new ForbiddenException("Global clinic scope required");
    await this.db.transaction(async transaction => {
      await this.lock(id, transaction);
      await this.access.require(clinicId, actor, transaction, true);
      const [existing] = await this.db.query<{ clinicId: string }>(
        'SELECT "clinicId" FROM patient_clinics WHERE "patientId"=:id AND "clinicId"=:clinicId',
        { replacements: { id, clinicId }, transaction, type: QueryTypes.SELECT }
      );
      if (existing) return;
      await this.db.query(
        'INSERT INTO patient_clinics ("patientId","clinicId","createdAt") VALUES (:id,:clinicId,NOW())',
        { replacements: { id, clinicId }, transaction }
      );
      await recordChange(
        this.db,
        transaction,
        patientChange("patient.clinic-associated", id, actor.id, null, { id, clinicId })
      );
    });
  }
  /**
   * Lists visible clinic associations for this patient.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async clinics(id: string, actor: AccessActor) {
    if (!(await this.read(id, actor))) throw new NotFoundException("Patient not found");
    const rows = await this.db.query<{ clinicId: string }>(
      `SELECT pc."clinicId" FROM patient_clinics pc WHERE pc."patientId"=:id
       AND (:all OR EXISTS(SELECT 1 FROM clinic_staff s WHERE s."clinicId"=pc."clinicId" AND s."userId"=:actorId))
       ORDER BY pc."clinicId"`,
      {
        replacements: { id, all: actor.permissions.includes("clinics:all"), actorId: actor.id },
        type: QueryTypes.SELECT
      }
    );
    return rows.map(row => row.clinicId);
  }
  /**
   * Removes the scope association without deleting the shared patient or its history.
   * @param id Patient identifier.
   * @param clinicId Clinic identifier.
   * @param actor Authenticated identity and current permissions.
   */
  async dissociate(id: string, clinicId: string, actor: AccessActor) {
    if (!actor.permissions.includes("clinics:all")) throw new ForbiddenException("Global clinic scope required");
    await this.db.transaction(async transaction => {
      await this.lock(id, transaction);
      await this.access.require(clinicId, actor, transaction);
      const rows = await this.db.query<{ clinicId: string }>(
        'DELETE FROM patient_clinics WHERE "patientId"=:id AND "clinicId"=:clinicId RETURNING "clinicId"',
        { replacements: { id, clinicId }, transaction, type: QueryTypes.SELECT }
      );
      if (rows.length)
        await recordChange(
          this.db,
          transaction,
          patientChange("patient.clinic-disassociated", id, actor.id, { id, clinicId }, null)
        );
    });
  }
  /**
   * Locks the persisted patient before a mutation.
   * @param id Resource identifier.
   * @param transaction Transaction containing the resource mutation.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async lock(id: string, transaction: Transaction) {
    const [row] = await this.db.query<PatientView>("SELECT * FROM patients WHERE id=:id FOR UPDATE", {
      replacements: { id },
      transaction,
      type: QueryTypes.SELECT
    });
    if (!row) throw new NotFoundException("Patient not found");
    return row;
  }
  /**
   * Locks current assignments and rejects out-of-scope patient writes.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current permissions.
   * @param transaction Transaction containing the resource mutation.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async requireScope(id: string, actor: AccessActor, transaction: Transaction) {
    if (actor.permissions.includes("clinics:all")) return;
    const rows = await this.db.query<{ clinicId: string }>(
      `SELECT pc."clinicId" FROM patient_clinics pc JOIN clinics c ON c.id=pc."clinicId" AND c.enabled
      JOIN clinic_staff s ON s."clinicId"=pc."clinicId" WHERE pc."patientId"=:id AND s."userId"=:actorId FOR SHARE OF c,s`,
      { replacements: { id, actorId: actor.id }, transaction, type: QueryTypes.SELECT }
    );
    if (!rows.length) throw new NotFoundException("Patient not found in assigned clinics");
  }
  /**
   * Saves allowlisted fields and their audit and notifications atomically.
   * @param before Persisted state before the operation.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current permissions.
   * @param transaction Transaction containing the resource mutation.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async save(
    before: PatientView,
    input: Partial<PatientInput> & { enabled?: boolean },
    actor: AccessActor,
    transaction: Transaction
  ) {
    if (before.userId && input.email !== undefined && input.email !== before.email)
      throw new ConflictException("Linked patient contact changes require verified account contact workflow");
    const next = { ...before };
    for (const field of ["firstName", "lastName", "email", "phone", "dpi", "birthDate", "address", "enabled"] as const)
      if (input[field] !== undefined) Object.assign(next, { [field]: input[field] });
    if (!next.firstName.trim() || !next.lastName.trim() || next.firstName.length + next.lastName.length > 119)
      throw new BadRequestException("Invalid combined patient names");
    const [after] = await this.db.query<PatientView>(
      `UPDATE patients SET "firstName"=:firstName,"lastName"=:lastName,email=:email,phone=:phone,dpi=:dpi,
       "birthDate"=:birthDate,address=:address,enabled=:enabled,"updatedAt"=NOW() WHERE id=:id RETURNING *`,
      { replacements: { ...next }, transaction, type: QueryTypes.SELECT }
    );
    await recordChange(
      this.db,
      transaction,
      patientChange("patient.updated", before.id, actor.id, before, after, before.userId)
    );
    return after;
  }
  /**
   * Maps uniqueness conflicts without exposing personal SQL parameters.
   * @param operation Transactional persistence operation.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async conflicts<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof UniqueConstraintError)
        throw new ConflictException("DPI or account already registered to a patient");
      throw error;
    }
  }
}
