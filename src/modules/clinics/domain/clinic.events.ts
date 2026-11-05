import { auditSnapshot } from "../../audit/domain/audit-snapshot";
import type { ChangeInput } from "../../audit/domain/change";
/**
 * Selects catalog fields only; staff events supply their own minimal snapshots.
 * @param action Stable audit action code.
 * @param id Resource identifier.
 * @param actorId Identity performing the operation.
 * @param before Persisted state before the operation.
 * @param after Persisted state after the operation.
 * @returns The result of the authorized resource operation.
 */
export function clinicChange(
  action: string,
  id: string,
  actorId: string | undefined,
  before: object | null,
  after: object | null
): ChangeInput {
  const fields = ["id", "code", "name", "address", "phone", "email", "enabled", "clinicId", "userId"];
  return {
    action,
    resourceType: "clinic",
    resourceId: id,
    actorId,
    before: auditSnapshot(before, fields),
    after: auditSnapshot(after, fields)
  };
}
