import { auditSnapshot } from "../../audit/domain/audit-snapshot";
import type { ChangeInput } from "../../audit/domain/change";
/**
 * Captures administrative identity data only, never credentials or clinical notes.
 * @param action Stable audit action code.
 * @param id Resource identifier.
 * @param actorId Identity performing the operation.
 * @param before Persisted state before the operation.
 * @param after Persisted state after the operation.
 * @param userId Account identifier selected by the server or verified against registered contact.
 * @returns The result of the authorized resource operation.
 */
export function patientChange(
  action: string,
  id: string,
  actorId: string,
  before: object | null,
  after: object | null,
  userId?: string | null
): ChangeInput {
  const fields = [
    "id",
    "firstName",
    "lastName",
    "email",
    "phone",
    "dpi",
    "birthDate",
    "address",
    "enabled",
    "userId",
    "clinicId"
  ];
  return {
    action,
    resourceType: "patient",
    resourceId: id,
    actorId,
    before: auditSnapshot(before, fields),
    after: auditSnapshot(after, fields),
    notifications: userId
      ? [
          {
            userId,
            title: "Registro de paciente actualizado",
            body: "Se actualizó tu registro administrativo en Blue Care."
          }
        ]
      : []
  };
}
