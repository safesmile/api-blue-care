import { PermissionCode } from "../../../shared/domain/permission-code";
import { requirePatientScope } from "./patient-scope";
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
  if (!actor.permissions.includes(PermissionCode.PatientsLink))
    throw new ForbiddenException("No tiene permiso para vincular pacientes");
  const [patient] = await db.query<PatientView>("SELECT * FROM patients WHERE id=:id FOR UPDATE", {
    replacements: { id },
    transaction,
    type: QueryTypes.SELECT
  });
  if (!patient?.enabled || patient.userId || !patient.email || patient.email !== email)
    throw new ConflictException(
      "La invitación debe dirigirse al correo registrado de un paciente activo y sin cuenta vinculada"
    );
  try {
    await requirePatientScope(db, transaction, id, { ...actor, clinicPermission: PermissionCode.PatientsLink });
  } catch {
    throw new ForbiddenException("El paciente está fuera de sus clínicas asignadas");
  }
}
