import type { ChangeInput } from "../../audit/domain/change";
import { auditSnapshot } from "../../audit/domain/audit-snapshot";
/**
 * Contains contractual state only, excluding checkout URLs, provider credentials and patient personal data.
 * @param action Stable lifecycle action.
 * @param id Resource identifier.
 * @param before Persisted state before the operation.
 * @param after Persisted state after the operation.
 * @param actorId Identity performing the operation.
 * @param userId Linked account receiving a general notification.
 * @returns The persisted result or completion of the authorized operation.
 */
export function membershipChange(
  action: string,
  id: string,
  before: object | null,
  after: object | null,
  actorId?: string,
  userId?: string | null
): ChangeInput {
  const fields = [
    "id",
    "patientId",
    "planVersionId",
    "cadence",
    "amountCents",
    "currency",
    "anchorAt",
    "periodStart",
    "paidThrough",
    "periodsCount",
    "suspendedAt",
    "cancelRequestedAt",
    "stoppedAt",
    "closedAt",
    "paymentId",
    "paidAt",
    "startsAt",
    "endsAt",
    "number",
    "subscriptionId"
  ];
  return {
    action,
    resourceType: "membership",
    resourceId: id,
    actorId,
    before: auditSnapshot(before, fields),
    after: auditSnapshot(after, fields),
    notifications: userId
      ? [
          {
            userId,
            title: "Membresía Blue Care +",
            body:
              action === "membership.payment-confirmed"
                ? "Se confirmó el pago de tu membresía. Consulta su vigencia en Blue Care."
                : "Se actualizó el estado de tu membresía. Consulta los detalles en Blue Care.",
            email: true
          }
        ]
      : []
  };
}
