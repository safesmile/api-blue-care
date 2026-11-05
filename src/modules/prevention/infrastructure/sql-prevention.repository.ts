import { auditSnapshot } from "../../audit/domain/audit-snapshot";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, Transaction, UniqueConstraintError, DatabaseError } from "sequelize";
import { randomUUID } from "node:crypto";
import {
  PreventionRepository,
  type EventInput,
  type EventQuery,
  type EventUpdate,
  type PreventionEvent,
  type PreventionType,
  type PreventionTypeInput
} from "../domain/prevention.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { ClinicAccess } from "../../clinics/infrastructure/clinic-access";
import { PATIENT_SCOPE_SQL, requirePatientScope } from "../../patients/infrastructure/patient-scope";
import { recordChange } from "../../audit/infrastructure/record-change";
import { persistNotification } from "../../notifications/infrastructure/persist-notification";
import { nextPreventiveDate } from "../domain/prevention-calendar";
const EVENT_SCOPE = `(:own AND p."userId"=:actorId OR NOT :own AND ${PATIENT_SCOPE_SQL}
 AND (:all OR EXISTS(SELECT 1 FROM clinic_staff s WHERE s."clinicId"=e."clinicId" AND s."userId"=:actorId)))`;
const SELECT = 'SELECT e.* FROM preventive_events e JOIN patients p ON p.id=e."patientId"';
/** Tracks preventive evidence and generates notifications atomically under patient/event locks. */
@Injectable()
export class SqlPreventionRepository extends PreventionRepository {
  /**
   * Receives the explicit persistence and transport dependencies.
   * @param db PostgreSQL connection.
   * @param clinics Explicit clinics value for this operation.
   */
  constructor(
    private readonly db: Sequelize,
    private readonly clinics: ClinicAccess
  ) {
    super();
  }
  /**
   * Lists configured preventive event types.
   * @param page Bounded pagination values.
   * @returns The authorized result or completion of the operation.
   */
  async types(page: Pagination) {
    const items = await this.db.query<PreventionType>(
      "SELECT id,code,name,enabled FROM prevention_types ORDER BY code,id LIMIT :limit OFFSET :offset",
      { replacements: { ...page }, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>("SELECT COUNT(*)::int total FROM prevention_types", {
      type: QueryTypes.SELECT
    });
    return { items, total: count.total };
  }
  /**
   * Saves a named preventive type without changing existing event snapshots.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  async saveType(id: string | null, input: PreventionTypeInput, actor: AccessActor) {
    return this.safe(() =>
      this.db.transaction(async transaction => {
        const [before] = id
          ? await this.db.query<PreventionType>("SELECT * FROM prevention_types WHERE id=:id FOR UPDATE", {
              replacements: { id },
              transaction,
              type: QueryTypes.SELECT
            })
          : [];
        if (id && !before) throw new NotFoundException("Preventive type not found");
        if (before && before.code !== input.code) throw new ConflictException("Type code is immutable");
        const key = id ?? randomUUID();
        const [after] = await this.db.query<PreventionType>(
          id
            ? 'UPDATE prevention_types SET name=:name,enabled=:enabled,"updatedAt"=NOW() WHERE id=:id RETURNING id,code,name,enabled'
            : "INSERT INTO prevention_types(id,code,name,enabled) VALUES (:id,:code,:name,:enabled) RETURNING id,code,name,enabled",
          { replacements: { ...input, id: key }, transaction, type: QueryTypes.SELECT }
        );
        await recordChange(this.db, transaction, {
          action: before ? "prevention.type-updated" : "prevention.type-created",
          resourceType: "prevention-type",
          resourceId: key,
          actorId: actor.id,
          before: before ? { code: before.code, name: before.name, enabled: before.enabled } : null,
          after: { ...after }
        });
        return after;
      })
    );
  }
  /**
   * Creates a preventive event without consuming a benefit.
   * @param input Validated operation fields.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  async create(input: EventInput, actor: AccessActor) {
    return this.safe(() =>
      this.db.transaction(async transaction => {
        await this.patient(input.patientId, actor, transaction);
        await this.clinics.require(input.clinicId, actor, transaction, true);
        const [existing] = await this.db.query<PreventionEvent & { idempotencyKey: string }>(
          'SELECT * FROM preventive_events WHERE "idempotencyKey"=:key',
          { replacements: { key: input.idempotencyKey }, transaction, type: QueryTypes.SELECT }
        );
        if (existing) {
          const same =
            existing.patientId === input.patientId &&
            existing.clinicId === input.clinicId &&
            existing.typeId === input.typeId &&
            existing.dueAt.getTime() === new Date(input.dueAt).getTime() &&
            existing.status === input.status &&
            existing.intervalMonths === input.intervalMonths &&
            JSON.stringify(existing.reminderHours) === JSON.stringify(input.reminderHours) &&
            existing.externalReference === (input.externalReference ?? null);
          if (!same) throw new ConflictException("Operation key reused with different or changed event");
          return existing;
        }
        return this.insert(input, actor.id, transaction);
      })
    );
  }
  /**
   * Reads the authorized preventive record.
   * @param id Resource identifier.
   * @param actor Authenticated caller and effective permissions.
   * @param own Whether the caller is restricted to its linked patient.
   * @returns The authorized result or completion of the operation.
   */
  async read(id: string, actor: AccessActor, own: boolean) {
    const [event] = await this.db.query<PreventionEvent>(SELECT + " WHERE e.id=:id AND " + EVENT_SCOPE, {
      replacements: { id, ...this.scope(actor, own) },
      type: QueryTypes.SELECT
    });
    return event ?? null;
  }
  /**
   * Lists bounded records within the current ownership scope.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and effective permissions.
   * @param own Whether the caller is restricted to its linked patient.
   * @returns The authorized result or completion of the operation.
   */
  async list(query: EventQuery, actor: AccessActor, own: boolean) {
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      if (query.clinicId && !own) await this.clinics.require(query.clinicId, actor, transaction);
      const replacements = {
        ...query,
        ...this.scope(actor, own),
        patientId: query.patientId ?? null,
        clinicId: query.clinicId ?? null,
        typeId: query.typeId ?? null,
        status: query.status ?? null,
        from: query.from ?? null,
        to: query.to ?? null
      };
      const where = ` WHERE ${EVENT_SCOPE} AND (CAST(:patientId AS UUID) IS NULL OR e."patientId"=:patientId)
        AND (CAST(:clinicId AS UUID) IS NULL OR e."clinicId"=:clinicId) AND (CAST(:typeId AS UUID) IS NULL OR e."typeId"=:typeId)
        AND (CAST(:status AS TEXT) IS NULL OR e.status=:status) AND (CAST(:from AS TIMESTAMPTZ) IS NULL OR e."dueAt">=CAST(:from AS TIMESTAMPTZ))
        AND (CAST(:to AS TIMESTAMPTZ) IS NULL OR e."dueAt"<CAST(:to AS TIMESTAMPTZ))`;
      const items = await this.db.query<PreventionEvent>(
        SELECT + where + ' ORDER BY e."dueAt",e.id LIMIT :limit OFFSET :offset',
        { replacements, transaction, type: QueryTypes.SELECT }
      );
      const [count] = await this.db.query<{ total: number }>(
        'SELECT COUNT(*)::int total FROM preventive_events e JOIN patients p ON p.id=e."patientId"' + where,
        { replacements, transaction, type: QueryTypes.SELECT }
      );
      return { items, total: count.total };
    });
  }
  /**
   * Reschedules an open event using its expected version.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  async update(id: string, input: EventUpdate, actor: AccessActor) {
    return this.safe(() =>
      this.db.transaction(async transaction => {
        const before = await this.lock(id, input.expectedVersion, actor, transaction);
        await this.clinics.require(before.clinicId, actor, transaction, true);
        const now = await this.now(transaction);
        if (new Date(input.dueAt) <= now) throw new BadRequestException("Future due date required for rescheduling");
        await this.invalidate(id, transaction);
        const [after] = await this.db.query<PreventionEvent>(
          `UPDATE preventive_events SET "dueAt"=:dueAt,status=:status,"intervalMonths"=:intervalMonths,
        "reminderHours"=CAST(:hours AS JSONB),"externalReference"=:externalReference,version=version+1,"updatedAt"=:now WHERE id=:id RETURNING *`,
          {
            replacements: {
              ...input,
              id,
              hours: JSON.stringify(input.reminderHours),
              externalReference: input.externalReference ?? null,
              now
            },
            transaction,
            type: QueryTypes.SELECT
          }
        );
        await this.reminders(after, now, transaction);
        await this.audit("prevention.rescheduled", before, after, actor.id, transaction);
        return after;
      })
    );
  }
  /**
   * Records completion and calculates the next patient-specific event.
   * @param id Resource identifier.
   * @param expectedVersion Explicit expectedVersion value for this operation.
   * @param occurredAt Explicit occurredAt value for this operation.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  async complete(id: string, expectedVersion: number, occurredAt: string, actor: AccessActor) {
    return this.safe(() =>
      this.db.transaction(async transaction => {
        const before = await this.lock(id, expectedVersion, actor, transaction);
        const now = await this.now(transaction),
          completedAt = new Date(occurredAt);
        if (completedAt > now) throw new BadRequestException("Completion cannot be in the future");
        await this.invalidate(id, transaction);
        const [event] = await this.db.query<PreventionEvent>(
          'UPDATE preventive_events SET status=\'completed\',"completedAt"=:completedAt,version=version+1,"updatedAt"=:now WHERE id=:id RETURNING *',
          { replacements: { id, completedAt, now }, transaction, type: QueryTypes.SELECT }
        );
        await this.audit("prevention.completed", before, event, actor.id, transaction);
        let next: PreventionEvent | null = null;
        if (event.intervalMonths) {
          const dueAt = nextPreventiveDate(completedAt, event.intervalMonths);
          next = await this.insert(
            {
              patientId: event.patientId,
              clinicId: event.clinicId,
              typeId: event.typeId,
              dueAt: dueAt.toISOString(),
              status: "planned",
              intervalMonths: event.intervalMonths,
              reminderHours: event.reminderHours,
              idempotencyKey: randomUUID()
            },
            actor.id,
            transaction,
            event.id
          );
        }
        return { event, next };
      })
    );
  }
  /**
   * Closes the event and invalidates pending reminders.
   * @param id Resource identifier.
   * @param expectedVersion Explicit expectedVersion value for this operation.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  async cancel(id: string, expectedVersion: number, actor: AccessActor) {
    return this.safe(() =>
      this.db.transaction(async transaction => {
        const before = await this.lock(id, expectedVersion, actor, transaction);
        await this.invalidate(id, transaction);
        const [after] = await this.db.query<PreventionEvent>(
          'UPDATE preventive_events SET status=\'cancelled\',"cancelledAt"=clock_timestamp(),version=version+1,"updatedAt"=clock_timestamp() WHERE id=:id RETURNING *',
          { replacements: { id }, transaction, type: QueryTypes.SELECT }
        );
        await this.audit("prevention.cancelled", before, after, actor.id, transaction);
        return after;
      })
    );
  }
  /**
   * Processes a bounded durable batch without external calls in resource transactions.
   * @returns The authorized result or completion of the operation.
   */
  async drain() {
    const candidates = await this.db.query<{ id: string; patientId: string }>(
      `SELECT DISTINCT e.id,e."patientId" FROM preventive_reminders r JOIN preventive_events e ON e.id=r."eventId"
      JOIN patients p ON p.id=e."patientId" JOIN clinics c ON c.id=e."clinicId" JOIN prevention_types t ON t.id=e."typeId"
      LEFT JOIN users u ON u.id=p."userId"
      WHERE (e."dueAt"<=clock_timestamp() OR (p.enabled AND c.enabled AND t.enabled AND u.enabled AND u.verified)) AND r.status='pending' AND r."dueAt"<=clock_timestamp() ORDER BY e.id LIMIT 50`,
      { type: QueryTypes.SELECT }
    );
    let generated = 0;
    const stopAt = Date.now() + 30000;
    for (const candidate of candidates) {
      if (Date.now() >= stopAt) break;
      generated += await this.safe(() =>
        this.db.transaction(async transaction => {
          const [patient] = await this.db.query<{ enabled: boolean; userId: string | null }>(
            'SELECT enabled,"userId" FROM patients WHERE id=:id FOR UPDATE SKIP LOCKED',
            { replacements: { id: candidate.patientId }, transaction, type: QueryTypes.SELECT }
          );
          if (!patient) return 0;
          const [event] = await this.db.query<PreventionEvent>(
            "SELECT * FROM preventive_events WHERE id=:id FOR UPDATE SKIP LOCKED",
            { replacements: { id: candidate.id }, transaction, type: QueryTypes.SELECT }
          );
          if (!event) return 0;
          const now = await this.now(transaction);
          if (event.dueAt <= now || !["planned", "scheduled"].includes(event.status)) {
            await this.db.query(
              "UPDATE preventive_reminders SET status='expired' WHERE \"eventId\"=:id AND status='pending'",
              { replacements: { id: event.id }, transaction }
            );
            return 0;
          }
          const [available] = await this.db.query<{ id: string }>(
            `SELECT u.id FROM users u JOIN clinics c ON c.id=:clinicId JOIN prevention_types t ON t.id=:typeId
        WHERE u.id=:userId AND u.enabled AND u.verified AND c.enabled AND t.enabled FOR SHARE OF u,c,t`,
            {
              replacements: { clinicId: event.clinicId, typeId: event.typeId, userId: patient.userId },
              transaction,
              type: QueryTypes.SELECT
            }
          );
          if (!patient.enabled || !available) return 0;
          const reminders = await this.db.query<{ id: string; hours: number }>(
            'SELECT id,hours FROM preventive_reminders WHERE "eventId"=:id AND version=:version AND status=\'pending\' AND "dueAt"<=:now ORDER BY hours DESC FOR UPDATE',
            { replacements: { id: event.id, version: event.version, now }, transaction, type: QueryTypes.SELECT }
          );
          for (const reminder of reminders) {
            const notice = await persistNotification(this.db, transaction, {
              key: "prevention:" + reminder.id,
              userId: available.id,
              title: "Recordatorio Blue Care",
              body: "Tienes un evento preventivo próximo. Consulta la fecha y los detalles en Blue Care.",
              email: true,
              push: true
            });
            await this.db.query(
              "UPDATE preventive_reminders SET status='generated',\"notificationId\"=:notificationId WHERE id=:id",
              { replacements: { id: reminder.id, notificationId: notice.id }, transaction }
            );
            await recordChange(this.db, transaction, {
              action: "prevention.reminder-generated",
              resourceType: "preventive-event",
              resourceId: event.id,
              after: { reminderId: reminder.id, eventVersion: event.version, hours: reminder.hours }
            });
          }
          return reminders.length;
        })
      );
    }
    return { generated };
  }
  /**
   * Reads the database clock after acquiring resource locks.
   * @param transaction Current resource transaction.
   * @returns The authorized result or completion of the operation.
   */
  async now(transaction: Transaction) {
    const [row] = await this.db.query<{ now: Date }>("SELECT clock_timestamp() AS now", {
      transaction,
      type: QueryTypes.SELECT
    });
    return row.now;
  }
  /**
   * Binds explicit clinic and patient ownership filters.
   * @param actor Authenticated caller and effective permissions.
   * @param own Whether the caller is restricted to its linked patient.
   * @returns The authorized result or completion of the operation.
   */
  private scope(actor: AccessActor, own: boolean) {
    return { actorId: actor.id, own, all: actor.permissions.includes("clinics:all") };
  }
  /**
   * Locks and authorizes the active patient.
   * @param id Resource identifier.
   * @param actor Authenticated caller and effective permissions.
   * @param transaction Current resource transaction.
   * @returns The authorized result or completion of the operation.
   */
  private async patient(id: string, actor: AccessActor, transaction: Transaction) {
    const [patient] = await this.db.query<{ enabled: boolean }>(
      "SELECT enabled FROM patients WHERE id=:id FOR UPDATE",
      { replacements: { id }, transaction, type: QueryTypes.SELECT }
    );
    if (!patient) throw new NotFoundException("Patient not found");
    await requirePatientScope(this.db, transaction, id, actor);
    if (!patient.enabled) throw new ConflictException("Patient is inactive");
  }
  /**
   * Locks the current open event and checks its expected version.
   * @param id Resource identifier.
   * @param expectedVersion Explicit expectedVersion value for this operation.
   * @param actor Authenticated caller and effective permissions.
   * @param transaction Current resource transaction.
   * @returns The authorized result or completion of the operation.
   */
  private async lock(id: string, expectedVersion: number, actor: AccessActor, transaction: Transaction) {
    const [hint] = await this.db.query<{ patientId: string }>(
      'SELECT "patientId" FROM preventive_events WHERE id=:id',
      { replacements: { id }, transaction, type: QueryTypes.SELECT }
    );
    if (!hint) throw new NotFoundException("Preventive event not found");
    await this.patient(hint.patientId, actor, transaction);
    const [event] = await this.db.query<PreventionEvent>("SELECT * FROM preventive_events WHERE id=:id FOR UPDATE", {
      replacements: { id },
      transaction,
      type: QueryTypes.SELECT
    });
    await this.clinics.require(event.clinicId, actor, transaction);
    if (event.version !== expectedVersion || !["planned", "scheduled"].includes(event.status))
      throw new ConflictException("Event changed or already closed; reload its current version");
    return event;
  }
  /**
   * Persists preventive evidence and its reminder schedule atomically.
   * @param input Validated operation fields.
   * @param actorId Explicit actorId value for this operation.
   * @param transaction Current resource transaction.
   * @param followUpOfId Explicit followUpOfId value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  private async insert(
    input: EventInput,
    actorId: string,
    transaction: Transaction,
    followUpOfId: string | null = null
  ) {
    const [type] = await this.db.query<PreventionType>("SELECT * FROM prevention_types WHERE id=:id FOR SHARE", {
      replacements: { id: input.typeId },
      transaction,
      type: QueryTypes.SELECT
    });
    if (!type?.enabled) throw new ConflictException("Preventive type is unavailable");
    const now = await this.now(transaction);
    if (!followUpOfId && new Date(input.dueAt) <= now)
      throw new BadRequestException("New events require a future due date");
    const [event] = await this.db.query<PreventionEvent>(
      `INSERT INTO preventive_events
      (id,"patientId","clinicId","typeId","typeName","dueAt",status,"intervalMonths","reminderHours","externalReference","followUpOfId","idempotencyKey","createdAt","updatedAt")
      VALUES (:id,:patientId,:clinicId,:typeId,:typeName,:dueAt,:status,:intervalMonths,CAST(:hours AS JSONB),:externalReference,:followUpOfId,:idempotencyKey,:now,:now) RETURNING *`,
      {
        replacements: {
          ...input,
          id: randomUUID(),
          typeName: type.name,
          hours: JSON.stringify(input.reminderHours),
          externalReference: input.externalReference ?? null,
          followUpOfId,
          now
        },
        transaction,
        type: QueryTypes.SELECT
      }
    );
    await this.reminders(event, now, transaction);
    await this.audit("prevention.created", null, event, actorId, transaction);
    return event;
  }
  /**
   * Schedules only reminder offsets that have not elapsed.
   * @param event Explicit event value for this operation.
   * @param now Explicit now value for this operation.
   * @param transaction Current resource transaction.
   * @returns The authorized result or completion of the operation.
   */
  private async reminders(event: PreventionEvent, now: Date, transaction: Transaction) {
    for (const hours of event.reminderHours) {
      const dueAt = new Date(event.dueAt.getTime() - hours * 3600000);
      if (dueAt < now) continue;
      await this.db.query(
        'INSERT INTO preventive_reminders(id,"eventId",version,hours,"dueAt",status) VALUES (:id,:eventId,:version,:hours,:dueAt,\'pending\')',
        { replacements: { id: randomUUID(), eventId: event.id, version: event.version, hours, dueAt }, transaction }
      );
    }
  }
  /**
   * Cancels obsolete reminders and their unsent deliveries.
   * @param id Resource identifier.
   * @param transaction Current resource transaction.
   * @returns The authorized result or completion of the operation.
   */
  private async invalidate(id: string, transaction: Transaction) {
    await this.db.query(
      `UPDATE notification_deliveries SET status='cancelled' WHERE status='pending' AND "notificationId" IN
      (SELECT "notificationId" FROM preventive_reminders WHERE "eventId"=:id)`,
      { replacements: { id }, transaction }
    );
    await this.db.query(
      `UPDATE notification_push_deliveries SET status='cancelled' WHERE status='pending' AND "notificationId" IN
      (SELECT "notificationId" FROM preventive_reminders WHERE "eventId"=:id)`,
      { replacements: { id }, transaction }
    );
    await this.db.query(
      `UPDATE notifications SET "cancelledAt"=clock_timestamp() WHERE id IN
      (SELECT "notificationId" FROM preventive_reminders WHERE "eventId"=:id)`,
      { replacements: { id }, transaction }
    );
    await this.db.query(
      "UPDATE preventive_reminders SET status='cancelled' WHERE \"eventId\"=:id AND status IN ('pending','generated')",
      { replacements: { id }, transaction }
    );
  }
  /**
   * Records an allowlisted snapshot in the resource transaction.
   * @param action Explicit action value for this operation.
   * @param before Explicit before value for this operation.
   * @param after Explicit after value for this operation.
   * @param actorId Explicit actorId value for this operation.
   * @param transaction Current resource transaction.
   * @returns The authorized result or completion of the operation.
   */
  private async audit(
    action: string,
    before: PreventionEvent | null,
    after: PreventionEvent,
    actorId: string,
    transaction: Transaction
  ) {
    await recordChange(this.db, transaction, {
      action,
      resourceType: "preventive-event",
      resourceId: after.id,
      actorId,
      before: auditSnapshot(before, [
        "id",
        "patientId",
        "clinicId",
        "typeId",
        "typeName",
        "dueAt",
        "status",
        "intervalMonths",
        "reminderHours",
        "version",
        "externalReference",
        "completedAt",
        "cancelledAt",
        "followUpOfId"
      ]),
      after: auditSnapshot(after, [
        "id",
        "patientId",
        "clinicId",
        "typeId",
        "typeName",
        "dueAt",
        "status",
        "intervalMonths",
        "reminderHours",
        "version",
        "externalReference",
        "completedAt",
        "cancelledAt",
        "followUpOfId"
      ])
    });
  }
  /**
   * Translates database failures without exposing bound parameters.
   * @param operation Explicit operation value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  private async safe<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof UniqueConstraintError)
        throw new ConflictException("Duplicate preventive reference or operation");
      if (error instanceof DatabaseError) throw new Error("Preventive persistence failed; transaction rolled back");
      throw error;
    }
  }
}
