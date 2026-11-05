import { ConflictException, Injectable } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, UniqueConstraintError, DatabaseError } from "sequelize";
import { createHash, randomUUID } from "node:crypto";
import { PushRepository, type PushDeviceInput, type PushDevice, type PushDelivery } from "../domain/push.repository";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { recordChange } from "../../audit/infrastructure/record-change";
const DEVICE_COLUMNS = 'id,platform,enabled,"createdAt","updatedAt"';
/** Device tokens are write-only API secrets; database leases serialize sender attempts. */
@Injectable()
export class SqlPushRepository extends PushRepository {
  /**
   * Receives the explicit persistence and transport dependencies.
   * @param db PostgreSQL connection.
   */
  constructor(private readonly db: Sequelize) {
    super();
  }
  /**
   * Registers the authenticated owner device without returning its token.
   * @param userId Explicit userId value for this operation.
   * @param input Validated operation fields.
   * @returns The authorized result or completion of the operation.
   */
  async register(userId: string, input: PushDeviceInput) {
    try {
      return await this.db.transaction(async transaction => {
        await this.db.query("SELECT id FROM users WHERE id=:userId FOR UPDATE", {
          replacements: { userId },
          transaction
        });
        const hash = createHash("sha256").update(input.token).digest("hex");
        const [existing] = await this.db.query<{ id: string; userId: string }>(
          'SELECT id,"userId" FROM push_devices WHERE "tokenHash"=:hash FOR UPDATE',
          { replacements: { hash }, transaction, type: QueryTypes.SELECT }
        );
        if (existing && existing.userId !== userId)
          throw new ConflictException("Device is already registered to another account");
        const [device] = await this.db.query<PushDevice>(
          existing
            ? 'UPDATE push_devices SET enabled=TRUE,platform=:platform,"updatedAt"=NOW() WHERE id=:id RETURNING ' +
                DEVICE_COLUMNS
            : 'INSERT INTO push_devices(id,"userId",token,"tokenHash",platform) VALUES (:id,:userId,:token,:hash,:platform) RETURNING ' +
                DEVICE_COLUMNS,
          {
            replacements: { ...input, id: existing?.id ?? randomUUID(), userId, hash },
            transaction,
            type: QueryTypes.SELECT
          }
        );
        await recordChange(this.db, transaction, {
          action: "notification.device-registered",
          resourceType: "push-device",
          resourceId: device.id,
          actorId: userId,
          after: { platform: device.platform, enabled: device.enabled }
        });
        return device;
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw new ConflictException("Device registration conflict");
      if (error instanceof DatabaseError) throw new Error("Push registration failed; transaction rolled back");
      throw error;
    }
  }
  /**
   * Lists bounded records within the current ownership scope.
   * @param userId Explicit userId value for this operation.
   * @param page Bounded pagination values.
   * @returns The authorized result or completion of the operation.
   */
  async list(userId: string, page: Pagination) {
    const items = await this.db.query<PushDevice>(
      "SELECT " +
        DEVICE_COLUMNS +
        ' FROM push_devices WHERE "userId"=:userId ORDER BY "createdAt",id LIMIT :limit OFFSET :offset',
      { replacements: { userId, ...page }, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>(
      'SELECT COUNT(*)::int total FROM push_devices WHERE "userId"=:userId',
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    return { items, total: count.total };
  }
  /**
   * Disables only a device belonging to the authenticated owner.
   * @param userId Explicit userId value for this operation.
   * @param id Resource identifier.
   * @returns The authorized result or completion of the operation.
   */
  async remove(userId: string, id: string) {
    return this.db.transaction(async transaction => {
      const rows = await this.db.query<PushDevice>(
        'UPDATE push_devices SET enabled=FALSE,"updatedAt"=NOW() WHERE id=:id AND "userId"=:userId RETURNING ' +
          DEVICE_COLUMNS,
        { replacements: { id, userId }, transaction, type: QueryTypes.SELECT }
      );
      if (!rows.length) return false;
      await this.db.query(
        "UPDATE notification_push_deliveries SET status='cancelled' WHERE \"deviceId\"=:id AND status='pending'",
        { replacements: { id }, transaction }
      );
      await recordChange(this.db, transaction, {
        action: "notification.device-removed",
        resourceType: "push-device",
        resourceId: id,
        actorId: userId,
        after: { enabled: false }
      });
      return true;
    });
  }
  /**
   * Finds due deliveries whose leases are available.
   * @returns The authorized result or completion of the operation.
   */
  async pending() {
    const rows = await this.db.query<{ id: string }>(
      `SELECT id FROM notification_push_deliveries WHERE status='pending' AND "nextAttemptAt"<=NOW()
      AND ("leasedUntil" IS NULL OR "leasedUntil"<NOW()) ORDER BY "nextAttemptAt",id LIMIT 25`,
      { type: QueryTypes.SELECT }
    );
    return rows.map(row => row.id);
  }
  /**
   * Claims a single delivery after revalidating its owner and source.
   * @param id Resource identifier.
   * @returns The authorized result or completion of the operation.
   */
  async claim(id: string) {
    await this.db.query(
      `UPDATE notification_push_deliveries d SET status='cancelled' WHERE d.id=:id AND d.status='pending' AND NOT EXISTS
      (SELECT 1 FROM push_devices p JOIN notifications n ON n.id=d."notificationId" JOIN users u ON u.id=n."userId"
      WHERE p.id=d."deviceId" AND p.enabled AND p."userId"=u.id AND u.enabled AND u.verified AND n."cancelledAt" IS NULL)`,
      { replacements: { id } }
    );
    const [delivery] = await this.db.query<PushDelivery>(
      `UPDATE notification_push_deliveries d SET lease=:lease,"leasedUntil"=NOW()+INTERVAL '2 minutes',attempts=attempts+1
      FROM notifications n,push_devices p WHERE d.id=:id AND n.id=d."notificationId" AND p.id=d."deviceId" AND d.status='pending'
      AND d."nextAttemptAt"<=NOW() AND (d."leasedUntil" IS NULL OR d."leasedUntil"<NOW())
      RETURNING d.id,d.lease,d.attempts,d."deviceId",d."notificationId",p.token,n.title,n.body`,
      { replacements: { id, lease: randomUUID() }, type: QueryTypes.SELECT }
    );
    return delivery ?? null;
  }
  /**
   * Commits the leased outcome and the durable retry delay.
   * @param delivery Explicit delivery value for this operation.
   * @param outcome Explicit outcome value for this operation.
   * @param maxAttempts Explicit maxAttempts value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  async finish(delivery: PushDelivery, outcome: "sent" | "invalid" | "retry", maxAttempts: number) {
    await this.db.transaction(async transaction => {
      const rows = await this.db.query<{ id: string }>(
        `UPDATE notification_push_deliveries SET status=:status,"leasedUntil"=NULL,lease=NULL,"lastAttemptAt"=NOW(),
        "nextAttemptAt"=NOW()+(:delay * INTERVAL '1 second'),"lastError"=:error WHERE id=:id AND lease=:lease AND status='pending' RETURNING id`,
        {
          replacements: {
            id: delivery.id,
            lease: delivery.lease,
            status:
              outcome === "sent"
                ? "sent"
                : outcome === "invalid"
                  ? "cancelled"
                  : delivery.attempts >= maxAttempts
                    ? "failed"
                    : "pending",
            delay: Math.min(3600, 30 * 2 ** Math.min(delivery.attempts, 7)),
            error: outcome === "sent" ? null : outcome === "invalid" ? "unregistered" : "transport_failed"
          },
          transaction,
          type: QueryTypes.SELECT
        }
      );
      if (rows.length && outcome === "invalid") {
        await this.db.query('UPDATE push_devices SET enabled=FALSE,"updatedAt"=NOW() WHERE id=:id', {
          replacements: { id: delivery.deviceId },
          transaction
        });
        await this.db.query(
          "UPDATE notification_push_deliveries SET status='cancelled' WHERE \"deviceId\"=:id AND status='pending'",
          { replacements: { id: delivery.deviceId }, transaction }
        );
      }
    });
  }
}
