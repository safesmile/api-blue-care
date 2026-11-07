import { clinicScopeParams } from "../../clinics/infrastructure/clinic-scope";
import { Injectable } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, Transaction } from "sequelize";
import { DashboardRepository, type DashboardQuery, type ExpiringMembership } from "../domain/dashboard.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import { ClinicAccess } from "../../clinics/infrastructure/clinic-access";
import { PATIENT_SCOPE_SQL } from "../../patients/infrastructure/patient-scope";
const PATIENT_FILTER = `p.enabled AND ${PATIENT_SCOPE_SQL} AND (CAST(:clinicId AS UUID) IS NULL OR EXISTS
 (SELECT 1 FROM patient_clinics pc WHERE pc."patientId"=p.id AND pc."clinicId"=:clinicId))`;
const ACTIVE = 'm."periodStart"<=:now AND m."paidThrough"> :now AND m."suspendedAt" IS NULL AND m."closedAt" IS NULL';
const EVENT_FILTER = `p.enabled AND c.enabled AND ${PATIENT_SCOPE_SQL} AND e.status IN ('planned','scheduled')
 AND (CAST(:clinicId AS UUID) IS NULL OR e."clinicId"=:clinicId)
 AND blue_care_clinic_allowed(:actorId,e."clinicId",CAST(:currentClinicId AS UUID),CAST(:clinicPermission AS TEXT))`;
/** Consistent PostgreSQL snapshots keep metrics and their filtered lists concordant. */
@Injectable()
export class SqlDashboardRepository extends DashboardRepository {
  /**
   * Recibe las dependencias de la operación.
   * @param db Dependencia tipada de db.
   * @param clinics Dependencia tipada de clinics.
   */
  constructor(
    private readonly db: Sequelize,
    private readonly clinics: ClinicAccess
  ) {
    super();
  }
  /**
   * Lists upcoming records using the aggregate eligibility predicate.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  async upcoming(query: DashboardQuery, actor: AccessActor) {
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      const replacements = await this.parameters(query, actor, transaction);
      const where = ` FROM preventive_events e JOIN patients p ON p.id=e."patientId" JOIN clinics c ON c.id=e."clinicId"
        WHERE ${EVENT_FILTER} AND e."dueAt">=:now AND e."dueAt"< :until`;
      const items = await this.db.query<{
        id: string;
        patientId: string;
        patientName: string;
        clinicId: string;
        typeName: string;
        dueAt: Date;
        status: string;
      }>(
        'SELECT e.id,e."patientId",(p."firstName"||\' \'||p."lastName") AS "patientName",e."clinicId",e."typeName",e."dueAt",e.status' +
          where +
          ' ORDER BY e."dueAt",e.id LIMIT :limit OFFSET :offset',
        { replacements, transaction, type: QueryTypes.SELECT }
      );
      const [count] = await this.db.query<{ total: number }>("SELECT COUNT(*)::int total" + where, {
        replacements,
        transaction,
        type: QueryTypes.SELECT
      });
      return { asOf: replacements.now, until: replacements.until, items, total: count.total };
    });
  }
  /**
   * Reads aggregate metrics in a consistent clinic-scoped snapshot.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  async metrics(query: DashboardQuery, actor: AccessActor) {
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      const replacements = await this.parameters(query, actor, transaction);
      const [members] = await this.db.query<{ activeMembers: number; expiringMemberships: number }>(
        `SELECT COUNT(DISTINCT m."patientId")::int AS "activeMembers",
        COUNT(*) FILTER(WHERE m."paidThrough"<=:until)::int AS "expiringMemberships"
        FROM memberships m JOIN patients p ON p.id=m."patientId" WHERE ${PATIENT_FILTER} AND ${ACTIVE}`,
        { replacements, transaction, type: QueryTypes.SELECT }
      );
      const [events] = await this.db.query<{ upcomingPreventiveEvents: number; overduePreventiveEvents: number }>(
        `SELECT
        COUNT(*) FILTER(WHERE e."dueAt">=:now AND e."dueAt"< :until)::int AS "upcomingPreventiveEvents",
        COUNT(*) FILTER(WHERE e."dueAt"< :now)::int AS "overduePreventiveEvents"
        FROM preventive_events e JOIN patients p ON p.id=e."patientId" JOIN clinics c ON c.id=e."clinicId"
        WHERE ${EVENT_FILTER}`,
        { replacements, transaction, type: QueryTypes.SELECT }
      );
      return { asOf: replacements.now, until: replacements.until, ...members, ...events };
    });
  }
  /**
   * Lists paid active memberships approaching expiration.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  async expiring(query: DashboardQuery, actor: AccessActor) {
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      const replacements = await this.parameters(query, actor, transaction);
      const where = ` FROM memberships m JOIN patients p ON p.id=m."patientId" WHERE ${PATIENT_FILTER} AND ${ACTIVE} AND m."paidThrough"<=:until`;
      const items = await this.db.query<ExpiringMembership>(
        'SELECT m.id,m."patientId",(p."firstName"||\' \'||p."lastName") AS "patientName",m."paidThrough",m."cancelRequestedAt" IS NOT NULL AS "cancelRequested"' +
          where +
          ' ORDER BY m."paidThrough",m.id LIMIT :limit OFFSET :offset',
        { replacements, transaction, type: QueryTypes.SELECT }
      );
      const [count] = await this.db.query<{ total: number }>("SELECT COUNT(*)::int total" + where, {
        replacements,
        transaction,
        type: QueryTypes.SELECT
      });
      return { asOf: replacements.now, until: replacements.until, items, total: count.total };
    });
  }
  /**
   * Binds the snapshot clock, horizon and authorized clinic filter.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and effective permissions.
   * @param transaction Current resource transaction.
   * @returns The authorized result or completion of the operation.
   */
  private async parameters(query: DashboardQuery, actor: AccessActor, transaction: Transaction) {
    if (query.clinicId) await this.clinics.require(query.clinicId, actor, transaction);
    const [clock] = await this.db.query<{ now: Date }>("SELECT CURRENT_TIMESTAMP AS now", {
      transaction,
      type: QueryTypes.SELECT
    });
    return {
      ...query,
      clinicId: query.clinicId ?? null,
      ...clinicScopeParams(actor),
      now: clock.now,
      until: new Date(clock.now.getTime() + query.days * 86400000)
    };
  }
}
