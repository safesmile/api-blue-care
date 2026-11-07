import { persistNotification } from "./persist-notification";
import { Injectable } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";
import { randomUUID } from "node:crypto";
import {
  NotificationRepository,
  type NotificationInput,
  type InboxNotification,
  type Delivery
} from "../domain/notification.repository";
/** PostgreSQL-backed inbox and outbox; leases allow safe concurrent workers and crash recovery. */
@Injectable()
export class SqlNotificationRepository extends NotificationRepository {
  /**
   * Recibe las dependencias de la operación.
   * @param db Dependencia tipada de db.
   */
  constructor(private readonly db: Sequelize) {
    super();
  }
  /**
   * Deduplicates event keys and snapshots verified recipients in the same transaction as the inbox entry.
   * @param input Validated operation input.
   * @returns Result of the completed operation.
   */
  async create(input: NotificationInput) {
    return this.db.transaction(transaction => persistNotification(this.db, transaction, input));
  }
  /**
   * Returns a bounded page without exposing delivery addresses or failures.
   * @param userId Owner identity from the authenticated session.
   * @param limit Maximum number of records.
   * @param offset Number of records to skip.
   * @returns Result of the completed operation.
   */
  async list(userId: string, limit: number, offset: number) {
    const replacements = { userId, limit, offset };
    const items = await this.db.query<InboxNotification>(
      `SELECT id, title, body, "createdAt", "readAt" FROM notifications
      WHERE "userId" = :userId AND "visibleAt" <= NOW() AND "cancelledAt" IS NULL ORDER BY "createdAt" DESC, id DESC LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );
    const counts = await this.db.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM notifications
      WHERE "userId" = :userId AND "visibleAt" <= NOW() AND "cancelledAt" IS NULL`,
      { replacements, type: QueryTypes.SELECT }
    );
    return { items, total: Number(counts[0].total) };
  }
  /**
   *
   * @param userId Owner identity from the authenticated session.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  async markRead(userId: string, id: string) {
    const rows = await this.db.query(
      `UPDATE notifications SET "readAt" = COALESCE("readAt", NOW())
      WHERE id = :id AND "userId" = :userId AND "visibleAt" <= NOW() AND "cancelledAt" IS NULL RETURNING id`,
      { replacements: { id, userId }, type: QueryTypes.SELECT }
    );
    return rows.length > 0;
  }
  /**
   *
   * @returns Result of the completed operation.
   */
  async pending() {
    const rows = await this.db.query<{ id: string }>(
      `SELECT id FROM notification_deliveries
      WHERE status = 'pending' AND "nextAttemptAt" <= NOW() AND ("leasedUntil" IS NULL OR "leasedUntil" < NOW())
      ORDER BY "nextAttemptAt", id LIMIT 25`,
      { type: QueryTypes.SELECT }
    );
    return rows.map(row => row.id);
  }
  /**
   * Claims due work atomically; expired leases can be reclaimed after process failure.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  async claim(id: string) {
    await this.db.query(
      `UPDATE notification_deliveries d SET status = 'cancelled'
      WHERE d.id = :id AND d.status = 'pending' AND NOT EXISTS
      (SELECT 1 FROM notifications n JOIN users u ON u.id = n."userId"
       WHERE n.id = d."notificationId" AND n."cancelledAt" IS NULL
       AND u.enabled = true AND u.verified = true AND u.email = d.email)`,
      { replacements: { id } }
    );
    const rows = await this.db.query<Delivery>(
      `UPDATE notification_deliveries d SET lease = :lease,
      "leasedUntil" = NOW() + INTERVAL '2 minutes', attempts = attempts + 1
      FROM notifications n WHERE d.id = :id AND n.id = d."notificationId"
      AND d.status = 'pending' AND d."nextAttemptAt" <= NOW()
      AND (d."leasedUntil" IS NULL OR d."leasedUntil" < NOW())
      RETURNING d.id, d.lease, d.attempts, d.email, n.title, n.body`,
      { replacements: { id, lease: randomUUID() }, type: QueryTypes.SELECT }
    );
    if (rows.length) return rows[0];
    const existing = await this.db.query<{ status: string }>(
      "SELECT status FROM notification_deliveries WHERE id = :id",
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    return !existing.length || existing[0].status !== "pending" ? ("done" as const) : null;
  }
  /**
   * Uses the lease token so a stale worker cannot overwrite a newer result.
   * @param delivery Claimed delivery and its lease token.
   * @param success Whether the transport accepted the email.
   * @param maxAttempts Maximum delivery attempts before terminal failure.
   */
  async finish(delivery: Delivery, success: boolean, maxAttempts: number) {
    await this.db.query(
      `UPDATE notification_deliveries SET status = :status,
      "leasedUntil" = NULL, lease = NULL, "lastAttemptAt" = NOW(),
      "nextAttemptAt" = NOW() + (:delay * INTERVAL '1 second'), "lastError" = :error
      WHERE id = :id AND lease = :lease AND status = 'pending'`,
      {
        replacements: {
          id: delivery.id,
          lease: delivery.lease,
          status: success ? "sent" : delivery.attempts >= maxAttempts ? "failed" : "pending",
          delay: Math.min(3600, 30 * 2 ** Math.min(delivery.attempts, 7)),
          error: success ? null : "transport_failed"
        }
      }
    );
  }
  /**
   *
   * @param userId Owner identity from the authenticated session.
   * @param key Stable business event key.
   * @returns Result of the completed operation.
   */
  async cancel(userId: string, key: string) {
    await this.db.transaction(async transaction => {
      await this.db.query(
        'UPDATE notifications SET "cancelledAt" = NOW() WHERE "userId" = :userId AND "eventKey" = :key',
        { replacements: { userId, key }, transaction }
      );
      await this.db.query(
        `UPDATE notification_deliveries SET status = 'cancelled' WHERE status = 'pending'
        AND "notificationId" IN (SELECT id FROM notifications WHERE "userId" = :userId AND "eventKey" = :key)`,
        { replacements: { userId, key }, transaction }
      );
    });
  }
}
