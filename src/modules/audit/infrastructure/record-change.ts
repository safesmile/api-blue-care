import { randomUUID } from "node:crypto";
import { QueryTypes, type Sequelize, type Transaction } from "sequelize";
import type { ChangeInput } from "../domain/change";
import { sanitizeSnapshot } from "../domain/audit-snapshot";
import { auditContext } from "./audit-context";
import { persistNotification } from "../../notifications/infrastructure/persist-notification";
/**
 * Atomically commits the mutation's history and notifications; delivery is always outside the transaction.
 * @param db PostgreSQL connection.
 * @param transaction Transaction containing the original resource mutation.
 * @param input Validated operation metadata.
 * @returns Result of the completed operation.
 */
export async function recordChange(db: Sequelize, transaction: Transaction, input: ChangeInput): Promise<string> {
  if (!transaction) throw new Error("A live resource transaction is required");
  const context = auditContext.getStore();
  const id = randomUUID(),
    actorId = input.actorId ?? context?.actorId ?? null;
  const [actor] = actorId
    ? await db.query<{ name: string }>("SELECT name FROM users WHERE id=:actorId", {
        replacements: { actorId },
        transaction,
        type: QueryTypes.SELECT
      })
    : [];
  const before = input.before === null || input.before === undefined ? null : sanitizeSnapshot(input.before);
  const after = input.after === null || input.after === undefined ? null : sanitizeSnapshot(input.after);
  if (JSON.stringify(before) === JSON.stringify(after) && input.action.endsWith(".updated")) return id;
  const reason = input.reason ?? context?.reason;
  if (reason !== undefined && (!reason.trim() || reason.length > 500)) throw new Error("Invalid audit reason");
  try {
    await db.query(
      `INSERT INTO audit_events
    (id,"occurredAt","requestId","actorId","actorType","actorName",action,"resourceType","resourceId",reason,"before","after")
    VALUES (:id,NOW(),:requestId,:actorId,:actorType,:actorName,:action,:resourceType,:resourceId,:reason,CAST(:before AS JSONB),CAST(:after AS JSONB))`,
      {
        replacements: {
          id,
          requestId: context?.requestId ?? randomUUID(),
          actorId,
          actorType: actorId ? "user" : "system",
          actorName: actor?.name ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          reason: reason?.trim() ?? null,
          before: before === null ? null : JSON.stringify(before),
          after: after === null ? null : JSON.stringify(after)
        },
        transaction
      }
    );
    for (const notification of input.notifications ?? []) {
      const [recipient] = await db.query<{ id: string }>("SELECT id FROM users WHERE id=:userId FOR KEY SHARE", {
        replacements: { userId: notification.userId },
        transaction,
        type: QueryTypes.SELECT
      });
      if (recipient)
        await persistNotification(db, transaction, { ...notification, key: "event:" + id + ":" + notification.userId });
    }
  } catch {
    // Never expose SQL replacements (snapshots/reasons) through framework error logs.
    throw new Error("Audit or notification persistence failed; resource transaction rolled back");
  }
  return id;
}
