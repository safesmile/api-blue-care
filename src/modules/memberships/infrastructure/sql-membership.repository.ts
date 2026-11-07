import { clinicScopeParams } from "../../clinics/infrastructure/clinic-scope";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, UniqueConstraintError, type Transaction } from "sequelize";
import { randomUUID } from "node:crypto";
import {
  MembershipRepository,
  type MembershipInput,
  type MembershipQuery,
  type MembershipRecord,
  type MembershipView,
  type MembershipPeriod
} from "../domain/membership.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import type { PatientView } from "../../patients/domain/patient.repository";
import type { PlanVersion } from "../../plans/domain/plan.repository";
import { PATIENT_SCOPE_SQL, requirePatientScope } from "../../patients/infrastructure/patient-scope";
import { membershipStatus } from "../domain/membership-state";
import { recordChange } from "../../audit/infrastructure/record-change";
import { membershipChange } from "../domain/membership.events";
const MEMBERSHIP_SELECT = `SELECT m.*, CASE
 WHEN EXISTS(SELECT 1 FROM recurrente_events e WHERE e."membershipId"=m.id AND e.status='review') OR m."checkoutStatus"='review' THEN 'review'
 WHEN EXISTS(SELECT 1 FROM membership_billing_jobs j WHERE j."membershipId"=m.id AND j.status IN ('pending','processing')) THEN 'pending'
 WHEN m."stoppedAt" IS NOT NULL THEN 'stopped'
 WHEN EXISTS(SELECT 1 FROM membership_billing_jobs j WHERE j."membershipId"=m.id AND j.kind='pause' AND j.status='done') THEN 'paused'
 WHEN m."subscriptionId" IS NOT NULL THEN 'active' ELSE 'not-started' END AS "billingSync",TO_JSONB(contracted) AS "contractedVersion",
 JSONB_BUILD_OBJECT('id',v.id,'number',v.number,'name',v.name,'description',v.description,'benefitDescriptions',v."benefitDescriptions",'publishedAt',v."publishedAt") AS "currentBenefits"
 FROM memberships m JOIN patients p ON p.id=m."patientId"
 JOIN plan_versions contracted ON contracted.id=m."planVersionId" JOIN plans plan ON plan.id=contracted."planId"
 LEFT JOIN plan_versions v ON v.id=plan."currentVersionId"`;
const ACCESS = '((:own AND p."userId"=:actorId) OR (NOT :own AND ' + PATIENT_SCOPE_SQL + "))";
/** Stores a single open contract per patient and never accepts client-selected payment or entitlement state. */
@Injectable()
export class SqlMembershipRepository extends MembershipRepository {
  /**
   * Recibe las dependencias de la operación.
   * @param db Dependencia tipada de db.
   */
  constructor(private readonly db: Sequelize) {
    super();
  }
  /**
   * Creates an explicitly authorized pending record.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether access is limited to the authenticated patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  async create(input: MembershipInput, actor: AccessActor, own: boolean) {
    const id = randomUUID();
    try {
      await this.db.transaction(async transaction => {
        const [patient] = await this.db.query<PatientView>("SELECT * FROM patients WHERE id=:patientId FOR UPDATE", {
          replacements: { patientId: input.patientId },
          transaction,
          type: QueryTypes.SELECT
        });
        if (!patient || (own && patient.userId !== actor.id)) throw new NotFoundException("No se encontró el paciente");
        if (!patient.enabled) throw new ConflictException("El paciente está inactivo");
        if (!own) await requirePatientScope(this.db, transaction, patient.id, actor);
        const prior = await this.db.query<MembershipRecord>(
          'SELECT * FROM memberships WHERE "patientId"=:patientId AND "closedAt" IS NULL FOR UPDATE',
          { replacements: { patientId: input.patientId }, transaction, type: QueryTypes.SELECT }
        );
        for (const record of prior) {
          if (
            record.cancelRequestedAt &&
            record.stoppedAt &&
            (!record.paidThrough || record.paidThrough <= new Date())
          ) {
            await this.db.query('UPDATE memberships SET "closedAt"=NOW() WHERE id=:oldId', {
              replacements: { oldId: record.id },
              transaction
            });
            await recordChange(
              this.db,
              transaction,
              membershipChange("membership.closed", record.id, record, { ...record, closedAt: new Date() }, actor.id)
            );
          } else throw new ConflictException("El paciente ya tiene una membresía abierta; renueve ese contrato");
        }
        const [version] = await this.db.query<PlanVersion>(
          `SELECT v.* FROM plan_versions v JOIN plans p ON p.id=v."planId"
          WHERE v.id=:versionId AND p.enabled AND p."currentVersionId"=v.id AND v."publishedAt" IS NOT NULL FOR SHARE OF p`,
          { replacements: { versionId: input.planVersionId }, transaction, type: QueryTypes.SELECT }
        );
        if (!version) throw new ConflictException("Seleccione la versión publicada vigente de un plan habilitado");
        const amountCents = input.cadence === "annual" ? version.annualPriceCents : version.monthlyPriceCents;
        const [record] = await this.db.query<MembershipRecord>(
          `INSERT INTO memberships (id,"patientId","planVersionId",cadence,"amountCents",currency,"createdAt")
          VALUES (:id,:patientId,:versionId,:cadence,:amountCents,'GTQ',NOW()) RETURNING *`,
          {
            replacements: { id, patientId: patient.id, versionId: version.id, cadence: input.cadence, amountCents },
            transaction,
            type: QueryTypes.SELECT
          }
        );
        await recordChange(this.db, transaction, membershipChange("membership.created", id, null, record, actor.id));
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError)
        throw new ConflictException("El paciente ya tiene una membresía abierta");
      throw error;
    }
    return (await this.read(id, actor, own))!;
  }
  /**
   * Reads one authorized resource without changing its state.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether access is limited to the authenticated patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  async read(id: string, actor: AccessActor, own: boolean) {
    const [row] = await this.db.query<MembershipView>(MEMBERSHIP_SELECT + " WHERE m.id=:id AND " + ACCESS, {
      replacements: { id, own, ...clinicScopeParams(actor), actorId: actor.id },
      type: QueryTypes.SELECT
    });
    return row ? { ...row, ...membershipStatus(row) } : null;
  }
  /**
   * Returns a bounded page within the caller scope.
   * @param query Bounded explicit search filters.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether access is limited to the authenticated patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  async list(query: MembershipQuery, actor: AccessActor, own: boolean) {
    const filter = " WHERE " + ACCESS + ' AND (:patientId IS NULL OR m."patientId"=:patientId)';
    const replacements = {
      ...query,
      patientId: query.patientId ?? null,
      own,
      ...clinicScopeParams(actor)
    };
    const items = await this.db.query<MembershipView>(
      MEMBERSHIP_SELECT + filter + ' ORDER BY m."createdAt" DESC,m.id DESC LIMIT :limit OFFSET :offset',
      { replacements, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>(
      'SELECT COUNT(*)::int total FROM memberships m JOIN patients p ON p.id=m."patientId"' + filter,
      { replacements, type: QueryTypes.SELECT }
    );
    return { items: items.map(row => ({ ...row, ...membershipStatus(row) })), total: count.total };
  }
  /**
   * Stops future renewals while preserving confirmed paid coverage.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether access is limited to the authenticated patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  async cancel(id: string, actor: AccessActor, own: boolean) {
    await this.transition(id, actor, own, false);
    return (await this.read(id, actor, own))!;
  }
  /**
   * Suspends benefit eligibility immediately and queues billing pause.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async suspend(id: string, actor: AccessActor) {
    await this.transition(id, actor, false, true);
    return (await this.read(id, actor, false))!;
  }
  /**
   * Lists immutable payments and their allocated periods.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether access is limited to the authenticated patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  async periods(id: string, page: Pagination, actor: AccessActor, own: boolean) {
    if (!(await this.read(id, actor, own))) throw new NotFoundException("No se encontró la membresía");
    const items = await this.db.query<MembershipPeriod>(
      'SELECT * FROM membership_periods WHERE "membershipId"=:id ORDER BY number DESC LIMIT :limit OFFSET :offset',
      { replacements: { id, ...page }, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>(
      'SELECT COUNT(*)::int total FROM membership_periods WHERE "membershipId"=:id',
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    return { items, total: count.total };
  }
  /**
   * Persists the state change, audit and billing work atomically.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether access is limited to the authenticated patient.
   * @param suspend Value required by this operation.
   */
  private async transition(id: string, actor: AccessActor, own: boolean, suspend: boolean) {
    await this.db.transaction(async transaction => {
      const [hint] = await this.db.query<MembershipRecord>("SELECT * FROM memberships WHERE id=:id", {
        replacements: { id },
        transaction,
        type: QueryTypes.SELECT
      });
      if (!hint) throw new NotFoundException("No se encontró la membresía");
      const [patient] = await this.db.query<PatientView>("SELECT * FROM patients WHERE id=:patientId FOR UPDATE", {
        replacements: { patientId: hint.patientId },
        transaction,
        type: QueryTypes.SELECT
      });
      if (own && patient.userId !== actor.id) throw new NotFoundException("No se encontró la membresía");
      if (!own) await requirePatientScope(this.db, transaction, hint.patientId, actor);
      const [before] = await this.db.query<MembershipRecord>("SELECT * FROM memberships WHERE id=:id FOR UPDATE", {
        replacements: { id },
        transaction,
        type: QueryTypes.SELECT
      });
      if (suspend && before.closedAt) throw new ConflictException("No se puede suspender una membresía cerrada");
      if (suspend ? before.suspendedAt : before.cancelRequestedAt) return;
      const field = suspend ? '"suspendedAt"' : '"cancelRequestedAt"';
      const [after] = await this.db.query<MembershipRecord>(
        "UPDATE memberships SET " + field + "=NOW() WHERE id=:id RETURNING *",
        { replacements: { id }, transaction, type: QueryTypes.SELECT }
      );
      if (!suspend && before.checkoutStatus === "none" && !before.subscriptionId && !before.paidThrough) {
        const now = new Date();
        await this.db.query('UPDATE memberships SET "stoppedAt"=:now,"closedAt"=:now WHERE id=:id', {
          replacements: { id, now },
          transaction
        });
        after.stoppedAt = now;
        after.closedAt = now;
      } else await enqueueBillingCommand(this.db, transaction, id, suspend ? "pause" : "stop");
      await recordChange(
        this.db,
        transaction,
        membershipChange(
          suspend ? "membership.suspended" : "membership.cancellation-requested",
          id,
          before,
          after,
          actor.id,
          patient.userId
        )
      );
    });
  }
}
/**
 * Adds idempotent external billing work to the caller's still-open transaction.
 * @param db PostgreSQL connection.
 * @param transaction Transaction containing this resource mutation.
 * @param id Resource identifier.
 * @param kind Whether to stop or pause future provider charges.
 */
export async function enqueueBillingCommand(
  db: Sequelize,
  transaction: Transaction,
  id: string,
  kind: "stop" | "pause"
) {
  await db.query(
    `INSERT INTO membership_billing_jobs (id,"membershipId",kind,status,attempts,"nextAttemptAt")
    VALUES (:jobId,:id,:kind,'pending',0,NOW()) ON CONFLICT ("membershipId",kind) DO NOTHING`,
    { replacements: { jobId: randomUUID(), id, kind }, transaction }
  );
}
