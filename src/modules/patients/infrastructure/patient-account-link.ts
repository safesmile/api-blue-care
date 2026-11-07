import { ConflictException } from "@nestjs/common";
import { QueryTypes, type Transaction, type Sequelize } from "sequelize";
import type { PatientView } from "../domain/patient.repository";
import { recordChange } from "../../audit/infrastructure/record-change";
import { patientChange } from "../domain/patient.events";
/**
 * Links only a live patient and a verified account controlling its exact registered email.
 * @param db PostgreSQL connection.
 * @param transaction Transaction containing the resource mutation.
 * @param id Resource identifier.
 * @param userId Account identifier selected by the server or verified against registered contact.
 * @param actorId Identity performing the operation.
 * @returns The result of the authorized resource operation.
 */
export async function linkPatientAccount(
  db: Sequelize,
  transaction: Transaction,
  id: string,
  userId: string,
  actorId: string
) {
  const [before] = await db.query<PatientView>("SELECT * FROM patients WHERE id=:id FOR UPDATE", {
    replacements: { id },
    transaction,
    type: QueryTypes.SELECT
  });
  const [user] = await db.query<{ email: string; enabled: boolean; verified: boolean }>(
    "SELECT email,enabled,verified FROM users WHERE id=:userId FOR UPDATE",
    { replacements: { userId }, transaction, type: QueryTypes.SELECT }
  );
  if (!before?.enabled || !user?.enabled || !user.verified || !before.email || before.email !== user.email)
    throw new ConflictException("El paciente y la cuenta verificada deben tener el mismo correo registrado");
  if (before.userId === userId) return before;
  if (before.userId) throw new ConflictException("El paciente ya está vinculado a otra cuenta");
  const [duplicate] = await db.query<{ id: string }>('SELECT id FROM patients WHERE "userId"=:userId', {
    replacements: { userId },
    transaction,
    type: QueryTypes.SELECT
  });
  if (duplicate) throw new ConflictException("La cuenta ya está vinculada a un paciente");
  const [after] = await db.query<PatientView>(
    'UPDATE patients SET "userId"=:userId,"updatedAt"=NOW() WHERE id=:id RETURNING *',
    { replacements: { id, userId }, transaction, type: QueryTypes.SELECT }
  );
  await recordChange(db, transaction, patientChange("patient.account-linked", id, actorId, before, after, userId));
  return after;
}
