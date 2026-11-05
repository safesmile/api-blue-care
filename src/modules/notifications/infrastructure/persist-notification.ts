import { QueryTypes, type Sequelize, type Transaction } from "sequelize";
import { randomUUID } from "node:crypto";
import type { NotificationInput } from "../domain/notification.repository";
/**
 * Writes inbox and outbox using the caller's still-open resource transaction.
 * @param db PostgreSQL connection.
 * @param transaction Transaction containing the original resource mutation.
 * @param input Validated operation metadata.
 * @returns Result of the completed operation.
 */
export async function persistNotification(db: Sequelize, transaction: Transaction, input: NotificationInput) {
  const rows = await db.query<{ id: string }>(
    `INSERT INTO notifications
        (id, "userId", "eventKey", title, body, "createdAt", "visibleAt")
        VALUES (:id, :userId, :key, :title, :body, NOW(), :visibleAt)
        ON CONFLICT ("userId", "eventKey") DO UPDATE SET "eventKey" = EXCLUDED."eventKey" RETURNING id`,
    {
      replacements: { ...input, id: randomUUID(), visibleAt: input.deliverAt || new Date() },
      transaction,
      type: QueryTypes.SELECT
    }
  );
  const id = rows[0].id;
  const users = await db.query<{ email: string }>(
    "SELECT email FROM users WHERE id = :userId AND enabled = true AND verified = true",
    { replacements: { userId: input.userId }, transaction, type: QueryTypes.SELECT }
  );
  if (input.email && users.length) {
    await db.query(
      `INSERT INTO notification_deliveries
          (id, "notificationId", email, status, attempts, "nextAttemptAt")
          VALUES (:deliveryId, :id, :email, 'pending', 0, :due)
          ON CONFLICT ("notificationId") DO NOTHING`,
      {
        replacements: { deliveryId: randomUUID(), id, email: users[0].email, due: input.deliverAt || new Date() },
        transaction
      }
    );
  }
  if (input.push && users.length)
    await db.query(
      `INSERT INTO notification_push_deliveries
    (id,"notificationId","deviceId","nextAttemptAt")
    SELECT gen_random_uuid(),:id,d.id,:due FROM push_devices d WHERE d."userId"=:userId AND d.enabled
    ON CONFLICT ("notificationId","deviceId") DO NOTHING`,
      { replacements: { id, userId: input.userId, due: input.deliverAt || new Date() }, transaction }
    );
  const deliveries = await db.query<{ id: string }>(
    'SELECT id FROM notification_deliveries WHERE "notificationId" = :id',
    { replacements: { id }, transaction, type: QueryTypes.SELECT }
  );
  return { id, deliveryId: deliveries[0]?.id || null };
}
