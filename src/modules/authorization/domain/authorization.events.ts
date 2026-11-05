import { auditSnapshot } from "../../audit/domain/audit-snapshot";
import type { ChangeInput } from "../../audit/domain/change";
/**
 * Captures only role configuration; recipients are resolved by the transactional role adapter.
 * @param action Stable lifecycle event name.
 * @param id Resource identifier.
 * @param actorId Server-selected identity performing the change.
 * @param before State before the mutation.
 * @param after State after the mutation.
 * @param recipients Affected user identifiers resolved by the role adapter.
 * @param reason Optional administrative explanation.
 * @returns Result of the completed operation.
 */
export function roleChange(
  action: "role.created" | "role.updated" | "role.deleted",
  id: string,
  actorId: string,
  before: object | null,
  after: object | null,
  recipients: string[] = [],
  reason?: string
): ChangeInput {
  const fields = ["id", "name", "description", "isProtected", "permissions"];
  const previous = auditSnapshot(before, fields),
    next = auditSnapshot(after, fields);
  for (const snapshot of [previous, next])
    if (Array.isArray(snapshot?.permissions)) snapshot.permissions = [...snapshot.permissions].sort();
  return {
    action,
    resourceType: "role",
    resourceId: id,
    actorId,
    reason,
    before: previous,
    after: next,
    notifications: (action === "role.updated" &&
    JSON.stringify(previous?.permissions) !== JSON.stringify(next?.permissions)
      ? recipients
      : []
    ).map(userId => ({
      userId,
      title: "Accesos actualizados",
      body: "Se actualizaron los permisos de un rol asignado a tu cuenta de Blue Care."
    }))
  };
}
