import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { DatabaseError, QueryTypes, Transaction, UniqueConstraintError } from "sequelize";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  BenefitOperationsRepository,
  type BeneficiaryInput,
  type BeneficiaryView,
  type BenefitBalance,
  type ConsumptionInput,
  type ConsumptionView,
  type ReversalView,
  type TicketConsumptionInput,
  type TicketInput
} from "../domain/benefit-operations.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { BenefitContext, type BenefitMembership } from "./benefit-context";
import { ClinicAccess } from "../../clinics/infrastructure/clinic-access";
import { periodEnd } from "../../memberships/domain/membership-state";
import { recordChange } from "../../audit/infrastructure/record-change";
import { benefitChange } from "../domain/benefit.events";
interface TicketRow {
  id: string;
  membershipId: string;
  benefitId: string;
  beneficiaryId: string | null;
  units: number;
  expiresAt: Date;
  consumedAt: Date | null;
}
const CONSUMPTION =
  'SELECT c.*,EXISTS(SELECT 1 FROM benefit_reversals r WHERE r."consumptionId"=c.id) AS reversed FROM benefit_consumptions c';
/** Serializes all quota mutations on the membership row and derives global usage from immutable ledger entries. */
@Injectable()
export class SqlBenefitOperationsRepository extends BenefitOperationsRepository {
  /**
   * Initializes the benefit service dependencies.
   * @param db PostgreSQL connection.
   * @param context Transactional resource and quota resolver.
   * @param clinics Current clinic assignment boundary.
   */
  constructor(
    private readonly db: Sequelize,
    private readonly context: BenefitContext,
    private readonly clinics: ClinicAccess
  ) {
    super();
  }
  /**
   * Lists the patient family independently of contract renewal.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether the resource is restricted to the account-linked patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  async family(id: string, page: Pagination, actor: AccessActor, own: boolean) {
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      const member = await this.context.membership(id, actor, own, transaction);
      const items = await this.db.query<BeneficiaryView>(
        `SELECT b.*,s.number,s."lockedUntil" FROM beneficiary_slots s JOIN beneficiaries b ON b.id=s."currentBeneficiaryId"
        WHERE s."patientId"=:patientId ORDER BY s.number LIMIT :limit OFFSET :offset`,
        { replacements: { patientId: member.patientId, ...page }, transaction, type: QueryTypes.SELECT }
      );
      const [count] = await this.db.query<{ total: number }>(
        'SELECT COUNT(*)::int total FROM beneficiary_slots WHERE "patientId"=:patientId',
        { replacements: { patientId: member.patientId }, transaction, type: QueryTypes.SELECT }
      );
      const [settings] = await this.db.query<{ maxBeneficiaries: number }>(
        'SELECT "maxBeneficiaries" FROM plan_family_settings WHERE "planId"=:planId',
        { replacements: { planId: member.planId }, transaction, type: QueryTypes.SELECT }
      );
      return { items, total: count.total, maxBeneficiaries: settings?.maxBeneficiaries ?? 4 };
    });
  }
  /**
   * Adds a relative within the current configured limit.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether the resource is restricted to the account-linked patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  async addBeneficiary(id: string, input: BeneficiaryInput, actor: AccessActor, own: boolean) {
    return this.safe(() =>
      this.db.transaction(async transaction => {
        const member = await this.context.membership(id, actor, own, transaction, true);
        const now = await this.context.now(transaction);
        this.context.requireActive(member, now);
        const max = await this.familyLimit(member, transaction);
        const [count] = await this.db.query<{ total: number }>(
          'SELECT COUNT(*)::int total FROM beneficiary_slots WHERE "patientId"=:patientId',
          { replacements: { patientId: member.patientId }, transaction, type: QueryTypes.SELECT }
        );
        if (count.total >= max) throw new ConflictException("Maximum additional beneficiaries reached");
        await this.notDuplicate(member.patientId, input, transaction);
        const slotId = randomUUID(),
          beneficiaryId = randomUUID(),
          lockedUntil = periodEnd(now, 1, "annual"),
          number = count.total + 1;
        await this.db.query(
          'INSERT INTO beneficiary_slots (id,"patientId",number,"lockedUntil","createdAt") VALUES (:slotId,:patientId,:number,:lockedUntil,:now)',
          { replacements: { slotId, patientId: member.patientId, number, lockedUntil, now }, transaction }
        );
        const value = await this.createBeneficiary(slotId, beneficiaryId, input, now, transaction);
        await this.db.query('UPDATE beneficiary_slots SET "currentBeneficiaryId"=:beneficiaryId WHERE id=:slotId', {
          replacements: { beneficiaryId, slotId },
          transaction
        });
        const after = { ...value, number, lockedUntil };
        await recordChange(
          this.db,
          transaction,
          benefitChange(
            "beneficiary.created",
            "beneficiary",
            beneficiaryId,
            actor.id,
            null,
            { ...after, patientId: member.patientId },
            member.userId
          )
        );
        return after;
      })
    );
  }
  /**
   * Replaces a relative after the annual lock has elapsed.
   * @param id Resource identifier.
   * @param beneficiaryId Selected family member, or omitted for the holder.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether the resource is restricted to the account-linked patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  async replaceBeneficiary(
    id: string,
    beneficiaryId: string,
    input: BeneficiaryInput,
    actor: AccessActor,
    own: boolean
  ) {
    return this.safe(() =>
      this.db.transaction(async transaction => {
        const member = await this.context.membership(id, actor, own, transaction, true);
        const now = await this.context.now(transaction);
        this.context.requireActive(member, now);
        const [before] = await this.db.query<BeneficiaryView>(
          `SELECT b.*,s.number,s."lockedUntil" FROM beneficiary_slots s JOIN beneficiaries b ON b.id=s."currentBeneficiaryId"
        WHERE s."patientId"=:patientId AND b.id=:beneficiaryId FOR UPDATE OF s`,
          { replacements: { patientId: member.patientId, beneficiaryId }, transaction, type: QueryTypes.SELECT }
        );
        if (!before) throw new NotFoundException("Current beneficiary not found");
        if (now < before.lockedUntil)
          throw new ConflictException("Beneficiary cannot be replaced until its annual lock ends");
        const max = await this.familyLimit(member, transaction);
        const [count] = await this.db.query<{ total: number }>(
          'SELECT COUNT(*)::int total FROM beneficiary_slots WHERE "patientId"=:patientId',
          { replacements: { patientId: member.patientId }, transaction, type: QueryTypes.SELECT }
        );
        if (count.total > max)
          throw new ConflictException("Preserved family exceeds the new maximum; new persons cannot be added");
        await this.notDuplicate(member.patientId, input, transaction);
        const value = await this.createBeneficiary(before.slotId, randomUUID(), input, now, transaction),
          lockedUntil = periodEnd(now, 1, "annual");
        await this.db.query(
          'UPDATE beneficiary_slots SET "currentBeneficiaryId"=:newId,"lockedUntil"=:lockedUntil WHERE id=:slotId',
          { replacements: { newId: value.id, lockedUntil, slotId: before.slotId }, transaction }
        );
        const after = { ...value, number: before.number, lockedUntil };
        await recordChange(
          this.db,
          transaction,
          benefitChange(
            "beneficiary.replaced",
            "beneficiary",
            value.id,
            actor.id,
            before,
            { ...after, patientId: member.patientId },
            member.userId
          )
        );
        return after;
      })
    );
  }
  /**
   * Reads global quota across clinics for the selected recipient.
   * @param id Resource identifier.
   * @param beneficiaryId Selected family member, or omitted for the holder.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether the resource is restricted to the account-linked patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  async balances(id: string, beneficiaryId: string | undefined, page: Pagination, actor: AccessActor, own: boolean) {
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      const member = await this.context.membership(id, actor, own, transaction),
        recipient = await this.context.recipient(member, beneficiaryId, transaction),
        now = await this.context.now(transaction);
      const definitions = await this.db.query<{ id: string }>(
        'SELECT id FROM benefit_definitions WHERE "planId"=:planId AND "currentVersionId" IS NOT NULL ORDER BY code,id LIMIT :limit OFFSET :offset',
        { replacements: { planId: member.planId, ...page }, transaction, type: QueryTypes.SELECT }
      );
      const items: BenefitBalance[] = [];
      for (const definition of definitions) {
        const benefit = await this.context.benefit(definition.id, member, transaction);
        items.push(await this.context.balance(member, benefit, recipient, beneficiaryId, now, transaction));
      }
      const [count] = await this.db.query<{ total: number }>(
        'SELECT COUNT(*)::int total FROM benefit_definitions WHERE "planId"=:planId AND "currentVersionId" IS NOT NULL',
        { replacements: { planId: member.planId }, transaction, type: QueryTypes.SELECT }
      );
      return { items, total: count.total };
    });
  }
  /**
   * Issues a short-lived owner presentation without reserving quota.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async issueTicket(id: string, input: TicketInput, actor: AccessActor) {
    return this.safe(() =>
      this.db.transaction(async transaction => {
        const member = await this.context.membership(id, actor, true, transaction, true),
          benefit = await this.context.benefit(input.benefitId, member, transaction, true);
        const recipient = await this.context.recipient(member, input.beneficiaryId, transaction),
          now = await this.context.now(transaction);
        const balance = await this.context.balance(member, benefit, recipient, input.beneficiaryId, now, transaction);
        this.sufficient(balance, input.units);
        const token = randomBytes(40).toString("hex"),
          expiresAt = new Date(now.getTime() + 5 * 60000),
          ticketId = randomUUID();
        await this.db.query(
          `INSERT INTO benefit_tickets (id,"membershipId","benefitId","beneficiaryId","tokenHash",units,"createdAt","expiresAt")
        VALUES (:ticketId,:id,:benefitId,:beneficiaryId,:hash,:units,:now,:expiresAt)`,
          {
            replacements: {
              ...input,
              id,
              ticketId,
              beneficiaryId: input.beneficiaryId ?? null,
              hash: this.digest(token),
              now,
              expiresAt
            },
            transaction
          }
        );
        await recordChange(this.db, transaction, {
          action: "benefit.ticket-issued",
          resourceType: "membership",
          resourceId: id,
          actorId: actor.id,
          after: {
            id: ticketId,
            benefitId: input.benefitId,
            beneficiaryId: input.beneficiaryId ?? null,
            units: input.units,
            expiresAt: expiresAt.toISOString()
          }
        });
        return { id: ticketId, token, expiresAt };
      })
    );
  }
  /**
   * Records an authorized service against global quota.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async consume(input: ConsumptionInput, actor: AccessActor) {
    return this.safe(() =>
      this.db.transaction(async transaction => {
        const member = await this.context.membership(input.membershipId, actor, false, transaction, true);
        return this.redeem(member, input, actor, transaction);
      })
    );
  }
  /**
   * Redeems the owner presentation in an authorized clinic.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async consumeTicket(input: TicketConsumptionInput, actor: AccessActor) {
    return this.safe(() =>
      this.db.transaction(async transaction => {
        const [hint] = await this.db.query<TicketRow>('SELECT * FROM benefit_tickets WHERE "tokenHash"=:hash', {
          replacements: { hash: this.digest(input.token) },
          transaction,
          type: QueryTypes.SELECT
        });
        if (!hint) throw new NotFoundException("Presentation ticket not found");
        const member = await this.context.membership(hint.membershipId, actor, false, transaction, true, true);
        const [ticket] = await this.db.query<TicketRow>("SELECT * FROM benefit_tickets WHERE id=:id FOR UPDATE", {
          replacements: { id: hint.id },
          transaction,
          type: QueryTypes.SELECT
        });
        const payload = {
          membershipId: member.id,
          benefitId: ticket.benefitId,
          beneficiaryId: ticket.beneficiaryId,
          units: ticket.units,
          clinicId: input.clinicId,
          serviceReference: input.serviceReference,
          idempotencyKey: input.idempotencyKey
        };
        return this.redeem(member, payload, actor, transaction, ticket);
      })
    );
  }
  /**
   * Reverses a consumption in its original period with a mandatory reason.
   * @param id Resource identifier.
   * @param reason Required correction reason.
   * @param idempotencyKey Stable key for exactly this operation payload.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async reverse(id: string, reason: string, idempotencyKey: string, actor: AccessActor) {
    return this.safe(() =>
      this.db.transaction(async transaction => {
        const [hint] = await this.db.query<ConsumptionView>(CONSUMPTION + " WHERE c.id=:id", {
          replacements: { id },
          transaction,
          type: QueryTypes.SELECT
        });
        if (!hint) throw new NotFoundException("Consumption not found");
        const member = await this.context.membership(hint.membershipId, actor, false, transaction, true, true);
        await this.clinics.require(hint.clinicId, actor, transaction);
        const [existing] = await this.db.query<ReversalView>(
          'SELECT * FROM benefit_reversals WHERE "consumptionId"=:id OR "idempotencyKey"=:idempotencyKey',
          { replacements: { id, idempotencyKey }, transaction, type: QueryTypes.SELECT }
        );
        if (existing) {
          if (existing.consumptionId === id && existing.idempotencyKey === idempotencyKey && existing.reason === reason)
            return existing;
          throw new ConflictException("Consumption is already reversed or operation key was reused");
        }
        const name = await this.context.actorName(actor, transaction),
          now = await this.context.now(transaction);
        const [reversal] = await this.db.query<ReversalView>(
          `INSERT INTO benefit_reversals (id,"consumptionId","performedBy","actorName",reason,"occurredAt","idempotencyKey")
         VALUES (:reversalId,:id,:actorId,:name,:reason,:now,:idempotencyKey) RETURNING *`,
          {
            replacements: { reversalId: randomUUID(), id, actorId: actor.id, name, reason, now, idempotencyKey },
            transaction,
            type: QueryTypes.SELECT
          }
        );
        await this.db.query('DELETE FROM benefit_service_claims WHERE "consumptionId"=:id', {
          replacements: { id },
          transaction
        });
        await recordChange(
          this.db,
          transaction,
          benefitChange(
            "benefit.consumption-reversed",
            "benefit-consumption",
            id,
            actor.id,
            hint,
            reversal,
            member.userId
          )
        );
        return reversal;
      })
    );
  }
  /**
   * Lists the authorized membership consumption history.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether the resource is restricted to the account-linked patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  async history(id: string, page: Pagination, actor: AccessActor, own: boolean) {
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      await this.context.membership(id, actor, own, transaction);
      const items = await this.db.query<ConsumptionView>(
        CONSUMPTION + ' WHERE c."membershipId"=:id ORDER BY c."occurredAt" DESC,c.id DESC LIMIT :limit OFFSET :offset',
        { replacements: { id, ...page }, transaction, type: QueryTypes.SELECT }
      );
      const [count] = await this.db.query<{ total: number }>(
        'SELECT COUNT(*)::int total FROM benefit_consumptions WHERE "membershipId"=:id',
        { replacements: { id }, transaction, type: QueryTypes.SELECT }
      );
      return { items, total: count.total };
    });
  }
  /**
   * Lists consumption evidence restricted to the authorized clinic.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async clinicHistory(id: string, page: Pagination, actor: AccessActor) {
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      await this.clinics.require(id, actor, transaction);
      const items = await this.db.query<ConsumptionView>(
        CONSUMPTION + ' WHERE c."clinicId"=:id ORDER BY c."occurredAt" DESC,c.id DESC LIMIT :limit OFFSET :offset',
        { replacements: { id, ...page }, transaction, type: QueryTypes.SELECT }
      );
      const [count] = await this.db.query<{ total: number }>(
        'SELECT COUNT(*)::int total FROM benefit_consumptions WHERE "clinicId"=:id',
        { replacements: { id }, transaction, type: QueryTypes.SELECT }
      );
      return { items, total: count.total };
    });
  }
  /**
   * Atomically validates and records a benefit redemption.
   * @param member Locked patient-global membership and its registered owner.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @param transaction Transaction containing the business mutation.
   * @param ticket Server-resolved presentation ticket.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async redeem(
    member: BenefitMembership,
    input: ConsumptionInput,
    actor: AccessActor,
    transaction: Transaction,
    ticket?: TicketRow
  ): Promise<ConsumptionView> {
    await this.clinics.require(input.clinicId, actor, transaction, true);
    const [existing] = await this.db.query<ConsumptionView>(CONSUMPTION + ' WHERE c."idempotencyKey"=:key', {
      replacements: { key: input.idempotencyKey },
      transaction,
      type: QueryTypes.SELECT
    });
    if (existing) {
      if (
        existing.membershipId !== input.membershipId ||
        existing.benefitId !== input.benefitId ||
        existing.beneficiaryId !== (input.beneficiaryId ?? null) ||
        existing.units !== input.units ||
        existing.clinicId !== input.clinicId ||
        existing.serviceReference !== input.serviceReference ||
        existing.ticketId !== (ticket?.id ?? null)
      )
        throw new ConflictException("Operation key reused with different consumption data");
      return existing;
    }
    const benefit = await this.context.benefit(input.benefitId, member, transaction, true);
    const recipient = await this.context.recipient(member, input.beneficiaryId, transaction),
      name = await this.context.actorName(actor, transaction),
      now = await this.context.now(transaction);
    if (ticket && (ticket.consumedAt || now >= ticket.expiresAt))
      throw new ConflictException("Presentation ticket expired or already used");
    const balance = await this.context.balance(member, benefit, recipient, input.beneficiaryId, now, transaction);
    this.sufficient(balance, input.units);
    const [clinic] = await this.db.query<{ name: string }>("SELECT name FROM clinics WHERE id=:id", {
      replacements: { id: input.clinicId },
      transaction,
      type: QueryTypes.SELECT
    });
    const id = randomUUID();
    const [record] = await this.db.query<ConsumptionView>(
      `INSERT INTO benefit_consumptions (id,"membershipId","benefitId","benefitVersionId","beneficiaryId","recipientKey","recipientName","clinicId","clinicName","performedBy","actorName",units,
       "limitSnapshot","discountBasisPoints","windowStart","windowEnd","occurredAt","serviceReference","idempotencyKey","ticketId")
       VALUES (:id,:membershipId,:benefitId,:versionId,:beneficiaryId,:recipientKey,:recipientName,:clinicId,:clinicName,:actorId,:name,:units,
       :limit,:discount,:start,:end,:now,:serviceReference,:idempotencyKey,:ticketId) RETURNING *`,
      {
        replacements: {
          ...input,
          id,
          versionId: benefit.currentVersionId,
          beneficiaryId: input.beneficiaryId ?? null,
          recipientKey: recipient.key,
          recipientName: recipient.name,
          clinicName: clinic.name,
          actorId: actor.id,
          name,
          limit: benefit.currentVersion!.limitUnits,
          discount: benefit.currentVersion!.discountBasisPoints ?? null,
          start: balance.windowStart,
          end: balance.windowEnd,
          now,
          ticketId: ticket?.id ?? null
        },
        transaction,
        type: QueryTypes.SELECT
      }
    );
    await this.db.query(
      `INSERT INTO benefit_service_claims ("membershipId","benefitId","recipientKey","clinicId","serviceReference","consumptionId")
      VALUES (:membershipId,:benefitId,:recipientKey,:clinicId,:serviceReference,:id)`,
      { replacements: { ...input, recipientKey: recipient.key, id }, transaction }
    );
    if (ticket)
      await this.db.query('UPDATE benefit_tickets SET "consumedAt"=:now WHERE id=:id', {
        replacements: { id: ticket.id, now },
        transaction
      });
    await recordChange(
      this.db,
      transaction,
      benefitChange("benefit.consumed", "benefit-consumption", id, actor.id, null, record, member.userId)
    );
    return { ...record, reversed: false };
  }
  /**
   * Rejects a redemption that exceeds the available quota.
   * @param balance Current global balance computed from the immutable ledger.
   * @param units Units actually consumed by the service.
   */
  private sufficient(balance: BenefitBalance, units: number) {
    if (!Number.isSafeInteger(units) || units < 1 || balance.remainingUnits < units)
      throw new ConflictException("Insufficient global benefit balance or recipient is ineligible");
  }
  /**
   * Validates and coordinates the authorized benefit operation.
   * @param member Locked patient-global membership and its registered owner.
   * @param transaction Transaction containing the business mutation.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async familyLimit(member: BenefitMembership, transaction: Transaction) {
    await this.db.query("SELECT id FROM plans WHERE id=:id FOR SHARE", {
      replacements: { id: member.planId },
      transaction,
      type: QueryTypes.SELECT
    });
    const [row] = await this.db.query<{ maxBeneficiaries: number }>(
      'SELECT "maxBeneficiaries" FROM plan_family_settings WHERE "planId"=:id',
      { replacements: { id: member.planId }, transaction, type: QueryTypes.SELECT }
    );
    return row?.maxBeneficiaries ?? 4;
  }
  /**
   * Validates and coordinates the authorized benefit operation.
   * @param patientId Patient owning the family.
   * @param input Validated operation fields.
   * @param transaction Transaction containing the business mutation.
   */
  private async notDuplicate(patientId: string, input: BeneficiaryInput, transaction: Transaction) {
    const [row] = await this.db.query<{ id: string }>(
      `SELECT b.id FROM beneficiaries b JOIN beneficiary_slots s ON s."currentBeneficiaryId"=b.id WHERE s."patientId"=:patientId
       AND LOWER(b."firstName")=LOWER(:firstName) AND LOWER(b."lastName")=LOWER(:lastName) AND b."birthDate" IS NOT DISTINCT FROM CAST(:birthDate AS DATE)`,
      {
        replacements: { ...input, patientId, birthDate: input.birthDate ?? null },
        transaction,
        type: QueryTypes.SELECT
      }
    );
    if (row) throw new ConflictException("An identical current beneficiary is already registered");
  }
  /**
   * Validates and coordinates the authorized benefit operation.
   * @param slotId Stable family position.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param now Current server instant.
   * @param transaction Transaction containing the business mutation.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async createBeneficiary(
    slotId: string,
    id: string,
    input: BeneficiaryInput,
    now: Date,
    transaction: Transaction
  ) {
    const [row] = await this.db.query<Omit<BeneficiaryView, "number" | "lockedUntil">>(
      'INSERT INTO beneficiaries (id,"slotId","firstName","lastName","birthDate","createdAt") VALUES (:id,:slotId,:firstName,:lastName,:birthDate,:now) RETURNING *',
      {
        replacements: { ...input, id, slotId, birthDate: input.birthDate ?? null, now },
        transaction,
        type: QueryTypes.SELECT
      }
    );
    return row;
  }
  /**
   * Validates and coordinates the authorized benefit operation.
   * @param token Opaque presentation credential, never written into the audit log.
   * @returns The persisted result or completion of the authorized operation.
   */
  private digest(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
  /**
   * Translates persistence conflicts without exposing SQL or personal parameters.
   * @param operation Transactional persistence operation.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async safe<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof UniqueConstraintError)
        throw new ConflictException("Duplicate operation key or service reference");
      if (error instanceof DatabaseError) {
        if (["40001", "40P01"].includes((error.original as { code?: string }).code ?? ""))
          throw new ConflictException("Concurrent resource change; retry the same operation");
        throw new Error("Benefit persistence failed; resource transaction rolled back");
      }
      throw error;
    }
  }
}
