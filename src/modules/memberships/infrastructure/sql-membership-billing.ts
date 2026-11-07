import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, type Transaction } from "sequelize";
import { randomUUID } from "node:crypto";
import {
  MembershipBilling,
  MembershipGateway,
  type VerifiedEvent,
  type VerifiedPayment
} from "../domain/membership-billing";
import type { MembershipRecord } from "../domain/membership.repository";
import { periodEnd } from "../domain/membership-state";
import { recordChange } from "../../audit/infrastructure/record-change";
import { membershipChange } from "../domain/membership.events";
import { enqueueBillingCommand } from "./sql-membership.repository";
interface BillingJob {
  id: string;
  membershipId: string;
  kind: "stop" | "pause";
  lease: string;
  attempts: number;
}
interface PaymentEvent extends VerifiedEvent {
  lease: string;
  attempts: number;
}
/** Durable payment inbox and billing outbox. Provider operations always run outside SQL transactions. */
@Injectable()
export class SqlMembershipBilling extends MembershipBilling {
  /**
   * Recibe las dependencias de la operación.
   * @param db Dependencia tipada de db.
   * @param gateway Dependencia tipada de gateway.
   */
  constructor(
    private readonly db: Sequelize,
    private readonly gateway: MembershipGateway
  ) {
    super();
  }
  /**
   * Obtains one durable hosted quote without repeating ambiguous provider creation.
   * @param id Resource identifier.
   * @returns The persisted result or completion of the authorized operation.
   */
  async checkout(id: string) {
    if (!this.gateway.available())
      throw new ServiceUnavailableException("La integración con Recurrente está deshabilitada");
    const request = await this.db.transaction(async transaction => {
      const [record] = await this.db.query<
        MembershipRecord & { name: string; currentVersionId: string; enabled: boolean }
      >(
        `SELECT m.*,v.name,p.enabled,p."currentVersionId" FROM memberships m JOIN plan_versions v ON v.id=m."planVersionId"
         JOIN plans p ON p.id=v."planId" WHERE m.id=:id FOR UPDATE OF m FOR SHARE OF p`,
        { replacements: { id }, transaction, type: QueryTypes.SELECT }
      );
      if (!record) throw new NotFoundException("No se encontró la membresía");
      if (record.cancelRequestedAt || record.suspendedAt || record.closedAt || record.periodsCount)
        throw new ConflictException("Solo se puede iniciar un pago para una membresía abierta y pendiente de pago");
      if (record.checkoutStatus === "ready" && record.checkoutExpiresAt && record.checkoutExpiresAt > new Date())
        return { existing: { id: record.checkoutId!, url: record.checkoutUrl! } };
      if (record.checkoutStatus !== "none")
        throw new ConflictException(
          "El pago ya existe, venció o requiere conciliación con el proveedor; no se creará un duplicado"
        );
      if (!record.enabled || record.currentVersionId !== record.planVersionId)
        throw new ConflictException(
          "La cotización pendiente ya no está vigente; cancélela y seleccione el precio publicado"
        );
      const expiresAt = new Date(Date.now() + 30 * 60000);
      await this.db.query(
        'UPDATE memberships SET "checkoutStatus"=\'creating\',"checkoutStartedAt"=NOW(),"checkoutExpiresAt"=:expiresAt WHERE id=:id',
        { replacements: { id, expiresAt }, transaction }
      );
      return {
        input: {
          membershipId: id,
          name: record.name,
          amountCents: record.amountCents,
          cadence: record.cadence,
          expiresAt
        }
      };
    });
    if (request.existing) return request.existing;
    let checkout: { id: string; url: string };
    try {
      checkout = await this.gateway.checkout(request.input!);
    } catch {
      await this.db.query(
        "UPDATE memberships SET \"checkoutStatus\"='review' WHERE id=:id AND \"checkoutStatus\"='creating'",
        { replacements: { id } }
      );
      throw new ServiceUnavailableException(
        "No se pudo confirmar la creación del pago; debe conciliarlo antes de intentar otro cobro"
      );
    }
    await this.db.query(
      'UPDATE memberships SET "checkoutId"=:checkoutId,"checkoutUrl"=:url,"checkoutStatus"=\'ready\' WHERE id=:id',
      { replacements: { id, checkoutId: checkout.id, url: checkout.url } }
    );
    const [state] = await this.db.query<MembershipRecord>("SELECT * FROM memberships WHERE id=:id", {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    if (state.cancelRequestedAt || state.suspendedAt)
      throw new ConflictException("La membresía se detuvo mientras se creaba la solicitud de pago");
    return checkout;
  }
  /**
   * Persists a verified minimal provider envelope before acknowledgement.
   * @param event Verified minimal provider event envelope.
   */
  async receive(event: VerifiedEvent) {
    await this.db.query(
      `INSERT INTO recurrente_events (id,"eventType","resourceId",status,attempts,"receivedAt","nextAttemptAt")
      VALUES (:id,:eventType,:resourceId,'pending',0,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`,
      { replacements: { ...event } }
    );
  }
  /**
   * Processes one bounded durable payment and billing batch.
   * @returns The persisted result or completion of the authorized operation.
   */
  async drain() {
    await this.db.query(`UPDATE memberships SET "checkoutStatus"='review'
      WHERE "checkoutStatus"='creating' AND "checkoutStartedAt"<NOW()-INTERVAL '5 minutes'`);
    await this.closeDueContracts();
    if (!this.gateway.available()) return { payments: 0, commands: 0, reviews: 0 };
    let payments = 0,
      commands = 0;
    for (let i = 0; i < 25; i++) {
      const job = await this.claim<PaymentEvent>("recurrente_events");
      if (!job) break;
      try {
        if (job.eventType === "intent.succeeded") {
          const payment = await this.gateway.payment(job.resourceId);
          if (!payment) await this.finish("recurrente_events", job, "review", "unverified-or-unsupported-payment");
          else await this.apply(payment, job);
        } else if (job.eventType === "subscription.cancel") await this.externalCancellation(job);
        else
          await this.finish(
            "recurrente_events",
            job,
            ["intent.failed", "intent.pending", "intent.canceled", "subscription.create"].includes(job.eventType)
              ? "done"
              : "review",
            "event-does-not-authorize-a-period"
          );
        payments++;
      } catch {
        await this.retry("recurrente_events", job);
      }
    }
    for (let i = 0; i < 25; i++) {
      const job = await this.claim<BillingJob>("membership_billing_jobs");
      if (!job) break;
      try {
        const [record] = await this.db.query<MembershipRecord>("SELECT * FROM memberships WHERE id=:id", {
          replacements: { id: job.membershipId },
          type: QueryTypes.SELECT
        });
        if (job.kind === "pause" && record.cancelRequestedAt) {
          await this.finish("membership_billing_jobs", job, "done");
          continue;
        }
        if (!record.subscriptionId) {
          if (record.checkoutStatus !== "none") {
            const checkout = record.checkoutId ? await this.gateway.checkoutState(record.checkoutId) : null;
            if (checkout?.paymentId)
              await this.receive({
                id: "reconcile_" + checkout.paymentId,
                eventType: "intent.succeeded",
                resourceId: checkout.paymentId
              });
            if (!checkout?.expiredUnpaid) {
              await this.retry("membership_billing_jobs", job, "awaiting-checkout-resolution");
              continue;
            }
          }
        } else await this.gateway.stop(record.subscriptionId, job.kind === "pause");
        await this.db.transaction(async transaction => {
          const [owned] = await this.db.query<BillingJob>(
            "SELECT * FROM membership_billing_jobs WHERE id=:id AND lease=:lease FOR UPDATE",
            { replacements: { id: job.id, lease: job.lease }, transaction, type: QueryTypes.SELECT }
          );
          if (!owned) return;
          if (job.kind === "stop")
            await this.db.query('UPDATE memberships SET "stoppedAt"=COALESCE("stoppedAt",NOW()) WHERE id=:id', {
              replacements: { id: record.id },
              transaction
            });
          await this.finish("membership_billing_jobs", job, "done", undefined, transaction);
          await recordChange(
            this.db,
            transaction,
            membershipChange("membership.billing-stopped", record.id, null, {
              id: record.id,
              subscriptionId: record.subscriptionId
            })
          );
        });
        commands++;
      } catch {
        await this.retry("membership_billing_jobs", job);
      }
    }
    await this.closeDueContracts();
    const [review] = await this.db.query<{ total: number }>(
      "SELECT COUNT(*)::int total FROM recurrente_events WHERE status='review'",
      { type: QueryTypes.SELECT }
    );
    return { payments, commands, reviews: review.total };
  }
  /**
   * Claims recoverable work with a lease and row locking.
   * @param table One of the two internal job tables.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async claim<T extends object>(table: "recurrente_events" | "membership_billing_jobs"): Promise<T | null> {
    const [row] = await this.db.query<T>(
      `UPDATE ${table} SET status='processing',lease=:lease,"leaseUntil"=NOW()+INTERVAL '5 minutes',attempts=attempts+1
      WHERE id=(SELECT id FROM ${table} WHERE (status='pending' AND "nextAttemptAt"<=NOW()) OR (status='processing' AND "leaseUntil"<NOW())
      ORDER BY "nextAttemptAt",id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
      { replacements: { lease: randomUUID() }, type: QueryTypes.SELECT }
    );
    return row ?? null;
  }
  /**
   * Completes work only while its lease is still owned.
   * @param table One of the two internal job tables.
   * @param job Durably claimed work and its lease.
   * @param job.id Stable persisted job identifier.
   * @param job.lease Lease used to reject stale workers.
   * @param status Durable processing outcome.
   * @param errorCode Non-sensitive operational outcome code.
   * @param transaction Transaction containing this resource mutation.
   */
  private async finish(
    table: "recurrente_events" | "membership_billing_jobs",
    job: { id: string; lease: string },
    status: string,
    errorCode?: string,
    transaction?: Transaction
  ) {
    await this.db.query(
      `UPDATE ${table} SET status=:status,"errorCode"=:errorCode,lease=NULL,"leaseUntil"=NULL WHERE id=:id AND lease=:lease`,
      { replacements: { id: job.id, lease: job.lease, status, errorCode: errorCode ?? null }, transaction }
    );
  }
  /**
   * Schedules capped backoff without exposing provider payloads.
   * @param table One of the two internal job tables.
   * @param job Durably claimed work and its lease.
   * @param job.id Stable persisted job identifier.
   * @param job.lease Lease used to reject stale workers.
   * @param job.attempts Number of attempts used for capped backoff.
   * @param errorCode Non-sensitive operational outcome code.
   */
  private async retry(
    table: "recurrente_events" | "membership_billing_jobs",
    job: { id: string; lease: string; attempts: number },
    errorCode = "provider-or-persistence-unavailable"
  ) {
    const delay = Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7));
    await this.db.query(
      `UPDATE ${table} SET status='pending',"errorCode"=:errorCode,"nextAttemptAt"=NOW() + :delay * INTERVAL '1 second',lease=NULL,"leaseUntil"=NULL WHERE id=:id AND lease=:lease`,
      { replacements: { id: job.id, lease: job.lease, errorCode, delay } }
    );
  }
  /**
   * Allocates a verified payment once and commits its period and notifications atomically.
   * @param payment Payment confirmed with the provider API.
   * @param job Durably claimed work and its lease.
   */
  private async apply(payment: VerifiedPayment, job: PaymentEvent) {
    await this.db.transaction(async transaction => {
      const [event] = await this.db.query<PaymentEvent>(
        "SELECT * FROM recurrente_events WHERE id=:id AND lease=:lease FOR UPDATE",
        { replacements: { id: job.id, lease: job.lease }, transaction, type: QueryTypes.SELECT }
      );
      if (!event) return;
      const [duplicate] = await this.db.query<{ id: string }>(
        'SELECT id FROM membership_periods WHERE "paymentId"=:paymentId',
        { replacements: { paymentId: payment.id }, transaction, type: QueryTypes.SELECT }
      );
      if (duplicate) {
        await this.finish("recurrente_events", job, "done", undefined, transaction);
        return;
      }
      const candidates = await this.db.query<MembershipRecord>(
        'SELECT * FROM memberships WHERE "subscriptionId"=:subscriptionId OR "checkoutId"=:checkoutId OR id=CAST(:membershipId AS UUID) FOR UPDATE',
        {
          replacements: {
            subscriptionId: payment.subscriptionId,
            checkoutId: payment.checkoutId,
            membershipId:
              payment.membershipId &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payment.membershipId)
                ? payment.membershipId
                : null
          },
          transaction,
          type: QueryTypes.SELECT
        }
      );
      const before = candidates.length === 1 ? candidates[0] : null;
      if (!before) {
        await this.finish("recurrente_events", job, "review", "unknown-or-ambiguous-contract", transaction);
        return;
      }
      await this.db.query('UPDATE recurrente_events SET "membershipId"=:membershipId WHERE id=:eventId', {
        replacements: { membershipId: before.id, eventId: job.id },
        transaction
      });
      if (before.subscriptionId && before.subscriptionId !== payment.subscriptionId) {
        await this.finish("recurrente_events", job, "review", "subscription-mismatch", transaction);
        return;
      }
      if (
        !before.subscriptionId &&
        (!payment.checkoutId ||
          (before.checkoutId && before.checkoutId !== payment.checkoutId) ||
          (before.checkoutStatus !== "creating" &&
            before.checkoutStatus !== "review" &&
            before.checkoutStatus !== "ready"))
      ) {
        await this.finish("recurrente_events", job, "review", "checkout-mismatch", transaction);
        return;
      }
      if (!before.subscriptionId)
        await this.db.query(
          'UPDATE memberships SET "subscriptionId"=:subscriptionId,"checkoutId"=COALESCE("checkoutId",:checkoutId) WHERE id=:id',
          {
            replacements: { id: before.id, subscriptionId: payment.subscriptionId, checkoutId: payment.checkoutId },
            transaction
          }
        );
      if (before.cancelRequestedAt || before.suspendedAt || before.closedAt) {
        await enqueueBillingCommand(
          this.db,
          transaction,
          before.id,
          before.cancelRequestedAt || before.closedAt ? "stop" : "pause"
        );
        // A command completed before this subscription was discovered must run again with its new provider ID.
        await this.db.query(
          "UPDATE membership_billing_jobs SET status='pending',\"nextAttemptAt\"=NOW() WHERE \"membershipId\"=:id AND status='done'",
          { replacements: { id: before.id }, transaction }
        );
        const requestedAt = Math.min(
          before.cancelRequestedAt?.getTime() ?? Infinity,
          before.suspendedAt?.getTime() ?? Infinity
        );
        if (before.closedAt || payment.paidAt.getTime() >= requestedAt) {
          await recordChange(
            this.db,
            transaction,
            membershipChange("membership.payment-review", before.id, null, {
              paymentId: payment.id,
              amountCents: payment.amountCents,
              paidAt: payment.paidAt
            })
          );
          await this.finish("recurrente_events", job, "review", "payment-after-stop", transaction);
          return;
        }
      }
      if (
        payment.amountCents !== before.amountCents ||
        payment.currency !== before.currency ||
        payment.paidAt > new Date(Date.now() + 60000) ||
        (!before.anchorAt &&
          (!before.checkoutExpiresAt ||
            payment.paidAt > before.checkoutExpiresAt ||
            !before.checkoutStartedAt ||
            payment.paidAt.getTime() < before.checkoutStartedAt.getTime() - 60000))
      ) {
        await enqueueBillingCommand(this.db, transaction, before.id, "pause");
        await this.finish("recurrente_events", job, "review", "amount-currency-or-payment-time-mismatch", transaction);
        return;
      }
      const anchor = before.anchorAt ?? payment.paidAt,
        number = before.periodsCount + 1;
      const startsAt = before.paidThrough ?? anchor,
        endsAt = periodEnd(anchor, number, before.cadence);
      if (payment.paidAt >= endsAt || (before.anchorAt && payment.paidAt < anchor)) {
        await enqueueBillingCommand(this.db, transaction, before.id, "pause");
        await this.finish("recurrente_events", job, "review", "payment-outside-next-period", transaction);
        return;
      }
      const [period] = await this.db.query<{ id: string }>(
        `INSERT INTO membership_periods (id,"membershipId","paymentId",number,"amountCents",currency,"paidAt","startsAt","endsAt","recordedAt")
        VALUES (:periodId,:id,:paymentId,:number,:amountCents,:currency,:paidAt,:startsAt,:endsAt,NOW())
        ON CONFLICT ("paymentId") DO NOTHING RETURNING id`,
        {
          replacements: {
            periodId: randomUUID(),
            id: before.id,
            paymentId: payment.id,
            number,
            amountCents: payment.amountCents,
            currency: payment.currency,
            paidAt: payment.paidAt,
            startsAt,
            endsAt
          },
          transaction,
          type: QueryTypes.SELECT
        }
      );
      if (!period) {
        await this.finish("recurrente_events", job, "done", undefined, transaction);
        return;
      }
      const [after] = await this.db.query<MembershipRecord>(
        `UPDATE memberships SET "anchorAt"=:anchor,"periodStart"=COALESCE("periodStart",:startsAt),"paidThrough"=:endsAt,
         "periodsCount"=:number,"checkoutStatus"='ready' WHERE id=:id RETURNING *`,
        { replacements: { id: before.id, anchor, startsAt, endsAt, number }, transaction, type: QueryTypes.SELECT }
      );
      const [patient] = await this.db.query<{ userId: string | null }>('SELECT "userId" FROM patients WHERE id=:id', {
        replacements: { id: before.patientId },
        transaction,
        type: QueryTypes.SELECT
      });
      await recordChange(
        this.db,
        transaction,
        membershipChange(
          "membership.payment-confirmed",
          before.id,
          before,
          { ...after, paymentId: payment.id, paidAt: payment.paidAt, startsAt, endsAt, number },
          undefined,
          patient.userId
        )
      );
      await this.finish("recurrente_events", job, "done", undefined, transaction);
    });
  }
  /**
   * Reconciles a signed provider cancellation without shortening paid coverage.
   * @param job Durably claimed work and its lease.
   */
  private async externalCancellation(job: PaymentEvent) {
    await this.db.transaction(async transaction => {
      const [record] = await this.db.query<MembershipRecord>(
        'SELECT * FROM memberships WHERE "subscriptionId"=:id FOR UPDATE',
        { replacements: { id: job.resourceId }, transaction, type: QueryTypes.SELECT }
      );
      if (!record) {
        await this.finish("recurrente_events", job, "review", "unknown-subscription", transaction);
        return;
      }
      if (!record.cancelRequestedAt || !record.stoppedAt) {
        const [after] = await this.db.query<MembershipRecord>(
          'UPDATE memberships SET "cancelRequestedAt"=COALESCE("cancelRequestedAt",NOW()),"stoppedAt"=COALESCE("stoppedAt",NOW()) WHERE id=:id RETURNING *',
          { replacements: { id: record.id }, transaction, type: QueryTypes.SELECT }
        );
        await recordChange(
          this.db,
          transaction,
          membershipChange("membership.provider-cancelled", record.id, record, after)
        );
      }
      await this.finish("recurrente_events", job, "done", undefined, transaction);
    });
  }
  /**
   * Closes cancelled contracts only after provider stop and paid expiry.
   */
  private async closeDueContracts() {
    await this.db.transaction(async transaction => {
      const rows = await this.db.query<MembershipRecord>(
        `SELECT * FROM memberships WHERE "cancelRequestedAt" IS NOT NULL AND "stoppedAt" IS NOT NULL
         AND "closedAt" IS NULL AND ("paidThrough" IS NULL OR "paidThrough"<=NOW()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 100`,
        { transaction, type: QueryTypes.SELECT }
      );
      for (const before of rows) {
        const [after] = await this.db.query<MembershipRecord>(
          'UPDATE memberships SET "closedAt"=NOW() WHERE id=:id RETURNING *',
          { replacements: { id: before.id }, transaction, type: QueryTypes.SELECT }
        );
        await recordChange(this.db, transaction, membershipChange("membership.closed", before.id, before, after));
      }
    });
  }
}
