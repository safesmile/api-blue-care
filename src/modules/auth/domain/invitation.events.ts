import { auditSnapshot } from "../../audit/domain/audit-snapshot";
import type { ChangeInput } from "../../audit/domain/change";
/**
 * Invitation history excludes raw credentials, digests and mail transport details.
 * @param action Stable lifecycle event name.
 * @param id Resource identifier.
 * @param actorId Server-selected identity performing the change.
 * @param before State before the mutation.
 * @param after State after the mutation.
 * @returns Result of the completed operation.
 */
export function invitationChange(
  action: "invitation.created" | "invitation.resent" | "invitation.revoked" | "invitation.accepted",
  id: string,
  actorId: string | undefined,
  before: object | null,
  after: object | null
): ChangeInput {
  const fields = [
    "kind",
    "clinicAssignments",
    "staff",
    "patientId",
    "email",
    "firstName",
    "lastName",
    "roles",
    "invitedBy",
    "status",
    "createdAt",
    "expiresAt",
    "acceptedAt",
    "acceptedUserId"
  ];
  return {
    action,
    resourceType: "invitation",
    resourceId: id,
    actorId,
    before: auditSnapshot(before, fields),
    after: auditSnapshot(after, fields)
  };
}
