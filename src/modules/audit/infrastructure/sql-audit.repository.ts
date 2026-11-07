import { PermissionCode } from "../../../shared/domain/permission-code";
import type { AccessActor } from "../../authorization/domain/access-policy";
import { clinicScopeParams } from "../../clinics/infrastructure/clinic-scope";
import { Injectable } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";
import { AuditRepository, type AuditRecord, type AuditQuery } from "../domain/audit.repository";
const ALLOWED =
  'blue_care_clinic_allowed(:actorId,pc."clinicId",CAST(:currentClinicId AS UUID),CAST(:clinicPermission AS TEXT))';
const AUDIT_SCOPE = `CASE a."resourceType"
 WHEN 'clinic' THEN EXISTS(SELECT 1
 FROM clinics c
 WHERE c.id::text=a."resourceId"
 AND blue_care_clinic_allowed(:actorId,c.id,CAST(:currentClinicId AS UUID),CAST(:clinicPermission AS TEXT)))
 WHEN 'patient' THEN EXISTS(SELECT 1
 FROM patient_clinics pc
 WHERE pc."patientId"::text=a."resourceId"
 AND ${ALLOWED})
 WHEN 'membership' THEN EXISTS(SELECT 1
 FROM memberships m
 JOIN patient_clinics pc
 ON pc."patientId"=m."patientId"
 WHERE m.id::text=a."resourceId"
 AND ${ALLOWED})
 WHEN 'preventive-event' THEN EXISTS(SELECT 1
 FROM preventive_events e
 WHERE e.id::text=a."resourceId"
 AND blue_care_clinic_allowed(:actorId,e."clinicId",CAST(:currentClinicId AS UUID),CAST(:clinicPermission AS TEXT)))
 WHEN 'benefit-consumption' THEN EXISTS(SELECT 1
 FROM benefit_consumptions c
 WHERE c.id::text=a."resourceId"
 AND blue_care_clinic_allowed(:actorId,c."clinicId",CAST(:currentClinicId AS UUID),CAST(:clinicPermission AS TEXT)))
 WHEN 'beneficiary' THEN EXISTS(SELECT 1
 FROM beneficiaries b
 JOIN beneficiary_slots s
 ON s.id=b."slotId"
 JOIN patient_clinics pc
 ON pc."patientId"=s."patientId"
 WHERE b.id::text=a."resourceId"
 AND ${ALLOWED})
 WHEN 'invitation' THEN EXISTS(SELECT 1
 FROM invitations i
 WHERE i.id::text=a."resourceId"
 AND (
   (jsonb_array_length(i."clinicAssignments")>0
 AND NOT EXISTS(SELECT 1
 FROM jsonb_array_elements(i."clinicAssignments") x
 WHERE NOT blue_care_clinic_allowed(:actorId,CAST(x->>'clinicId' AS UUID),CAST(:currentClinicId AS UUID),CAST(:clinicPermission AS TEXT))))

 OR (i."patientId" IS NOT NULL
 AND EXISTS(SELECT 1
 FROM patient_clinics pc
 WHERE pc."patientId"=i."patientId"
 AND ${ALLOWED}))

 OR (i."patientId" IS NULL
 AND jsonb_array_length(i."clinicAssignments")=0
 AND :globalAudit)))
 ELSE :globalAudit END`;
/** Only fixed columns and parameterized values can participate in audit filtering. */
@Injectable()
export class SqlAuditRepository extends AuditRepository {
  /**
   * Recibe las dependencias de la operación.
   * @param db Dependencia tipada de db.
   */
  constructor(private readonly db: Sequelize) {
    super();
  }
  /**
   *
   * @param query Validated audit filters and bounded pagination.
   * @param actor Authenticated caller and current role grants.
   * @returns Result of the completed operation.
   */
  async list(query: AuditQuery, actor: AccessActor) {
    const conditions: string[] = [AUDIT_SCOPE];
    for (const key of ["actorId", "action", "resourceType", "resourceId"] as const)
      if (query[key]) conditions.push('a."' + key + '" = :' + (key === "actorId" ? "filterActorId" : key));
    if (query.from) conditions.push('"occurredAt" >= :from');
    if (query.to) conditions.push('"occurredAt" <= :to');
    const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
    const items = await this.db.query<AuditRecord>(
      "SELECT a.* FROM audit_events a" + where + ' ORDER BY "occurredAt" DESC,id DESC LIMIT :limit OFFSET :offset',
      {
        replacements: {
          ...query,
          ...clinicScopeParams(actor),
          filterActorId: query.actorId ?? null,
          globalAudit: (actor.globalPermissions ?? actor.permissions).includes(PermissionCode.AuditList)
        },
        type: QueryTypes.SELECT
      }
    );
    const [count] = await this.db.query<{ total: number }>(
      "SELECT COUNT(*)::int AS total FROM audit_events a" + where,
      {
        replacements: {
          ...query,
          ...clinicScopeParams(actor),
          filterActorId: query.actorId ?? null,
          globalAudit: (actor.globalPermissions ?? actor.permissions).includes(PermissionCode.AuditList)
        },
        type: QueryTypes.SELECT
      }
    );
    return { items, total: count.total };
  }
  /**
   *
   * @param id Resource identifier.
   * @param actor Authenticated caller and current role grants.
   * @returns Result of the completed operation.
   */
  async read(id: string, actor: AccessActor) {
    const [record] = await this.db.query<AuditRecord>(
      "SELECT a.* FROM audit_events a WHERE a.id=:id AND " + AUDIT_SCOPE,
      {
        replacements: {
          id,
          ...clinicScopeParams(actor),
          globalAudit: (actor.globalPermissions ?? actor.permissions).includes(PermissionCode.AuditRead)
        },
        type: QueryTypes.SELECT
      }
    );
    return record ?? null;
  }
}
