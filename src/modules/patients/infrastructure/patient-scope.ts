import { NotFoundException } from "@nestjs/common";
import { QueryTypes, type Sequelize, type Transaction } from "sequelize";
import type { AccessActor } from "../../authorization/domain/access-policy";
/** Shared SQL fragment for adapters that join the patient as p. Input values remain bound parameters. */
export const PATIENT_SCOPE_SQL = `(:all OR EXISTS(SELECT 1 FROM patient_clinics pc JOIN clinics c ON c.id=pc."clinicId" AND c.enabled
 JOIN clinic_staff s ON s."clinicId"=pc."clinicId" WHERE pc."patientId"=p.id AND s."userId"=:actorId))`;
/**
 * Locks current clinic grants before a dependent business mutation. Caller must lock the patient first.
 * @param db PostgreSQL connection.
 * @param transaction Transaction containing this resource mutation.
 * @param id Resource identifier.
 * @param actor Authenticated identity and current effective permissions.
 */
export async function requirePatientScope(db: Sequelize, transaction: Transaction, id: string, actor: AccessActor) {
  if (actor.permissions.includes("clinics:all")) return;
  const rows = await db.query<{ clinicId: string }>(
    `SELECT pc."clinicId" FROM patient_clinics pc JOIN clinics c ON c.id=pc."clinicId" AND c.enabled
     JOIN clinic_staff s ON s."clinicId"=pc."clinicId" WHERE pc."patientId"=:id AND s."userId"=:actorId FOR SHARE OF c,s`,
    { replacements: { id, actorId: actor.id }, transaction, type: QueryTypes.SELECT }
  );
  if (!rows.length) throw new NotFoundException("Patient not found in assigned clinics");
}
