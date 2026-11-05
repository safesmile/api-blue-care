import { auditSnapshot } from "../../audit/domain/audit-snapshot";
import type { ChangeInput } from "../../audit/domain/change";
const fields = ["id", "email", "firstName", "lastName", "name", "enabled", "verified", "roles"] as const;
const messages: Record<string, { title: string; body: string; email?: boolean }> = {
  "user.created": { title: "Cuenta registrada", body: "Tu cuenta de Blue Care fue registrada." },
  "user.updated": {
    title: "Cuenta actualizada",
    body: "Se actualizaron los datos o accesos de tu cuenta de Blue Care."
  },
  "user.activated": {
    title: "Bienvenido a Blue Care",
    body: "Tu cuenta está activada. Puedes consultar las opciones disponibles."
  },
  "user.password-changed": {
    title: "Contraseña actualizada",
    body: "Se cambió la contraseña de tu cuenta de Blue Care.",
    email: true
  },
  "user.password-reset": {
    title: "Contraseña restablecida",
    body: "Se restableció la contraseña de tu cuenta de Blue Care.",
    email: true
  },
  "user.email-changed": {
    title: "Correo actualizado",
    body: "Se confirmó el cambio de correo de tu cuenta de Blue Care.",
    email: true
  }
};
/**
 * Domain-owned lifecycle definitions; secrets never enter snapshots or notification payloads.
 * @param action Stable lifecycle event name.
 * @param id Resource identifier.
 * @param actorId Server-selected identity performing the change.
 * @param before State before the mutation.
 * @param after State after the mutation.
 * @returns Result of the completed operation.
 */
export function identityChange(
  action: keyof typeof messages | "user.deleted",
  id: string,
  actorId: string | undefined,
  before: object | null,
  after: object | null
): ChangeInput {
  const previous = auditSnapshot(before, fields),
    next = auditSnapshot(after, fields);
  for (const snapshot of [previous, next])
    if (Array.isArray(snapshot?.roles)) snapshot.roles = [...snapshot.roles].sort();
  const message = messages[action];
  return {
    action,
    resourceType: "user",
    resourceId: id,
    actorId,
    before: previous,
    after: next,
    notifications: message ? [{ userId: id, ...message }] : []
  };
}
