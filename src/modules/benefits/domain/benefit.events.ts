import { auditSnapshot } from "../../audit/domain/audit-snapshot";
import type { ChangeInput } from "../../audit/domain/change";
/**
 * Allowlisted event data excludes presentation tokens and never contains full request bodies.
 * @param action Stable lifecycle action.
 * @param resourceType Audited resource category.
 * @param id Resource identifier.
 * @param actorId Server-selected identity performing the operation.
 * @param before State before the operation.
 * @param after State after the operation.
 * @param userId Account receiving a general inbox notice.
 * @returns The persisted result or completion of the authorized operation.
 */
export function benefitChange(
  action: string,
  resourceType: "beneficiary" | "benefit-consumption",
  id: string,
  actorId: string,
  before: object | null,
  after: object | null,
  userId?: string | null
): ChangeInput {
  const fields = [
    "id",
    "membershipId",
    "patientId",
    "benefitId",
    "benefitVersionId",
    "beneficiaryId",
    "recipientKey",
    "clinicId",
    "performedBy",
    "units",
    "limitSnapshot",
    "discountBasisPoints",
    "windowStart",
    "windowEnd",
    "occurredAt",
    "serviceReference",
    "consumptionId",
    "reason",
    "slotId",
    "number",
    "firstName",
    "lastName",
    "birthDate",
    "lockedUntil"
  ];
  return {
    action,
    resourceType,
    resourceId: id,
    actorId,
    before: auditSnapshot(before, fields),
    after: auditSnapshot(after, fields),
    notifications: userId
      ? [
          {
            userId,
            title: "Beneficios Blue Care",
            body:
              resourceType === "beneficiary"
                ? "Se actualizó tu núcleo familiar en Blue Care."
                : "Se registró un movimiento de tus beneficios. Consulta los detalles en Blue Care."
          }
        ]
      : []
  };
}
