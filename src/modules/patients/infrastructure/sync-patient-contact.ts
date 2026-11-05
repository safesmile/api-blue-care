import { QueryTypes, type Sequelize, type Transaction } from "sequelize";
import type { PatientView } from "../domain/patient.repository";
import { patientChange } from "../domain/patient.events";
import { recordChange } from "../../audit/infrastructure/record-change";
/**
 * Propagates only an already verified account contact, in the account confirmation transaction.
 * @param db PostgreSQL connection.
 * @param transaction Transaction containing the resource mutation.
 * @param userId Account identifier selected by the server or verified against registered contact.
 * @param email Normalized contact email.
 */
export async function syncPatientContact(db: Sequelize, transaction: Transaction, userId: string, email: string) {
  const [before] = await db.query<PatientView>('SELECT * FROM patients WHERE "userId"=:userId FOR UPDATE', {
    replacements: { userId },
    transaction,
    type: QueryTypes.SELECT
  });
  if (!before || before.email === email) return;
  const [after] = await db.query<PatientView>(
    'UPDATE patients SET email=:email,"updatedAt"=NOW() WHERE id=:id RETURNING *',
    { replacements: { email, id: before.id }, transaction, type: QueryTypes.SELECT }
  );
  await recordChange(db, transaction, patientChange("patient.contact-verified", before.id, userId, before, after));
}
