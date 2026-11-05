import { ConflictException, ForbiddenException } from "@nestjs/common";
import { QueryTypes, type Transaction, type Sequelize } from "sequelize";
import type { AccessActor } from "../../authorization/domain/access-policy";
import type { PatientView } from "../domain/patient.repository";
/**
 * Revalidates patient invitation authority and immutable destination inside its transaction.
 * @param db PostgreSQL connection.
 * @param transaction Transaction containing the resource mutation.
 * @param id Resource identifier.
 * @param email Normalized contact email.
 * @param actor Authenticated identity and current permissions.
 */
export async function requirePatientInvitation(
  db: Sequelize,
  transaction: Transaction,
  id: string,
  email: string,
  actor: AccessActor
) {
  if (!actor.permissions.includes("patients:link")) throw new ForbiddenException("Patient linking permission required");
  const [patient] = await db.query<PatientView>("SELECT * FROM patients WHERE id=:id FOR UPDATE", {
    replacements: { id },
    transaction,
    type: QueryTypes.SELECT
  });
  if (!patient?.enabled || patient.userId || !patient.email || patient.email !== email)
    throw new ConflictException("Invitation must target an active unlinked patient's registered email");
  if (!actor.permissions.includes("clinics:all")) {
    const [scope] = await db.query<{ clinicId: string }>(
      `SELECT pc."clinicId" FROM patient_clinics pc JOIN clinics c ON c.id=pc."clinicId" AND c.enabled
      JOIN clinic_staff s ON s."clinicId"=pc."clinicId" WHERE pc."patientId"=:id AND s."userId"=:actorId FOR SHARE OF c,s`,
      { replacements: { id, actorId: actor.id }, transaction, type: QueryTypes.SELECT }
    );
    if (!scope) throw new ForbiddenException("Patient outside assigned clinics");
  }
}
