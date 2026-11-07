import { clinicScopeParams } from "../../clinics/infrastructure/clinic-scope";
import { NotFoundException } from "@nestjs/common";
import { QueryTypes, type Sequelize, type Transaction } from "sequelize";
import type { AccessActor } from "../../authorization/domain/access-policy";
/** Shared SQL fragment for adapters that join the patient as p. Input values remain bound parameters. */
export const PATIENT_SCOPE_SQL = `EXISTS(SELECT 1 FROM patient_clinics pc JOIN clinics c ON c.id=pc."clinicId" AND c.enabled
 WHERE pc."patientId"=p.id AND blue_care_clinic_allowed(:actorId,c.id,CAST(:currentClinicId AS UUID),CAST(:clinicPermission AS TEXT)))`;
/**
 * Locks current clinic grants before a dependent business mutation. Caller must lock the patient first.
 * @param db PostgreSQL connection.
 * @param transaction Transaction containing this resource mutation.
 * @param id Resource identifier.
 * @param actor Authenticated identity and current effective permissions.
 */
export async function requirePatientScope(db: Sequelize, transaction: Transaction, id: string, actor: AccessActor) {
  const rows = await db.query<{ clinicId: string }>(
    `SELECT pc."clinicId"
 FROM patient_clinics pc
 JOIN clinics c
 ON c.id=pc."clinicId"
 AND c.enabled

 JOIN clinic_staff s
 ON s."clinicId"=pc."clinicId"
 WHERE pc."patientId"=:id
 AND s."userId"=:actorId
 AND blue_care_clinic_allowed(:actorId,c.id,CAST(:currentClinicId AS UUID),CAST(:clinicPermission AS TEXT)) FOR SHARE OF c,s`,
    { replacements: { id, ...clinicScopeParams(actor) }, transaction, type: QueryTypes.SELECT }
  );
  if (!rows.length) throw new NotFoundException("No se encontró el paciente en las clínicas asignadas");
}
