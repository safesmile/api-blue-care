import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, type Transaction } from "sequelize";
import type { AccessActor } from "../../authorization/domain/access-policy";
import type { MembershipRecord } from "../../memberships/domain/membership.repository";
import type { BenefitView } from "../domain/benefit.repository";
import type { BeneficiaryView, BenefitBalance } from "../domain/benefit-operations.repository";
import { PATIENT_SCOPE_SQL, requirePatientScope } from "../../patients/infrastructure/patient-scope";
import { membershipStatus } from "../../memberships/domain/membership-state";
import { benefitWindow } from "../domain/benefit-window";
export interface BenefitMembership extends MembershipRecord {
  planId: string;
  userId: string | null;
  patientEnabled: boolean;
  patientName: string;
}
export interface BenefitRecipient {
  key: string;
  active: boolean;
  name: string;
}
const MEMBERSHIP = `SELECT m.*,v."planId",p."userId",p.enabled AS "patientEnabled",(p."firstName" || ' ' || p."lastName") AS "patientName"
 FROM memberships m JOIN plan_versions v ON v.id=m."planVersionId" JOIN patients p ON p.id=m."patientId"`;
/** Common transactional resource and quota resolution; ticket presentation grants no general patient access. */
@Injectable()
export class BenefitContext {
  /**
   * Initializes the benefit service dependencies.
   * @param db PostgreSQL connection.
   */
  constructor(private readonly db: Sequelize) {}
  /**
   * Resolves ownership, clinic scope and paid contract state.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether the resource is restricted to the account-linked patient.
   * @param transaction Transaction containing the business mutation.
   * @param write Whether to lock the patient and membership before mutation.
   * @param presented Whether a verified patient presentation grants narrowly scoped consumption access.
   * @returns The persisted result or completion of the authorized operation.
   */
  async membership(
    id: string,
    actor: AccessActor,
    own: boolean,
    transaction: Transaction,
    write = false,
    presented = false
  ): Promise<BenefitMembership> {
    if (write) {
      const [hint] = await this.db.query<{ patientId: string }>('SELECT "patientId" FROM memberships WHERE id=:id', {
        replacements: { id },
        transaction,
        type: QueryTypes.SELECT
      });
      if (!hint) throw new NotFoundException("Membership not found");
      const [patient] = await this.db.query<{ userId: string | null }>(
        'SELECT "userId" FROM patients WHERE id=:patientId FOR UPDATE',
        { replacements: { patientId: hint.patientId }, transaction, type: QueryTypes.SELECT }
      );
      if (own && patient.userId !== actor.id) throw new NotFoundException("Membership not found");
      if (!own && !presented) await requirePatientScope(this.db, transaction, hint.patientId, actor);
    }
    const access = write ? "" : ' AND ((:own AND p."userId"=:actorId) OR (NOT :own AND ' + PATIENT_SCOPE_SQL + "))";
    const [row] = await this.db.query<BenefitMembership>(
      MEMBERSHIP + " WHERE m.id=:id" + access + (write ? " FOR UPDATE OF m" : ""),
      {
        replacements: { id, own, actorId: actor.id, all: actor.permissions.includes("clinics:all") },
        transaction,
        type: QueryTypes.SELECT
      }
    );
    if (!row) throw new NotFoundException("Membership not found");
    return row;
  }
  /**
   * Reads a consistent published rule under the requested lock.
   * @param id Resource identifier.
   * @param membership Patient-global contractual state.
   * @param transaction Transaction containing the business mutation.
   * @param lock Whether publication must wait for this operation.
   * @returns The persisted result or completion of the authorized operation.
   */
  async benefit(id: string, membership: BenefitMembership, transaction: Transaction, lock = false) {
    // Lock the pointer before joining its immutable revision: a blocked join could otherwise mix old rule data
    // with a newly published pointer under PostgreSQL READ COMMITTED rechecks.
    if (lock)
      await this.db.query('SELECT id FROM benefit_definitions WHERE id=:id AND "planId"=:planId FOR SHARE', {
        replacements: { id, planId: membership.planId },
        transaction,
        type: QueryTypes.SELECT
      });
    const [row] = await this.db.query<BenefitView>(
      'SELECT b.*,TO_JSONB(v) AS "currentVersion" FROM benefit_definitions b LEFT JOIN benefit_versions v ON v.id=b."currentVersionId" WHERE b.id=:id AND b."planId"=:planId',
      { replacements: { id, planId: membership.planId }, transaction, type: QueryTypes.SELECT }
    );
    if (!row) throw new NotFoundException("Benefit does not belong to this membership plan");
    if (!row.currentVersion) throw new ConflictException("Benefit has no published rules");
    return row;
  }
  /**
   * Resolves the holder or an immutable family identity.
   * @param membership Patient-global contractual state.
   * @param beneficiaryId Selected family member, or omitted for the holder.
   * @param transaction Transaction containing the business mutation.
   * @returns The persisted result or completion of the authorized operation.
   */
  async recipient(
    membership: BenefitMembership,
    beneficiaryId: string | null | undefined,
    transaction: Transaction
  ): Promise<BenefitRecipient> {
    if (!beneficiaryId) return { key: membership.patientId, active: true, name: membership.patientName };
    const [row] = await this.db.query<BeneficiaryView & { active: boolean }>(
      `SELECT b.*,s."currentBeneficiaryId"=b.id AS active FROM beneficiaries b JOIN beneficiary_slots s ON s.id=b."slotId"
       WHERE b.id=:beneficiaryId AND s."patientId"=:patientId`,
      { replacements: { beneficiaryId, patientId: membership.patientId }, transaction, type: QueryTypes.SELECT }
    );
    if (!row) throw new NotFoundException("Beneficiary does not belong to this patient");
    return { key: row.id, active: row.active, name: row.firstName + " " + row.lastName };
  }
  /**
   * Reads the database clock after acquiring the operation locks.
   * @param transaction Transaction containing the business mutation.
   * @returns The persisted result or completion of the authorized operation.
   */
  async now(transaction: Transaction) {
    const [row] = await this.db.query<{ now: Date }>("SELECT clock_timestamp() AS now", {
      transaction,
      type: QueryTypes.SELECT
    });
    return row.now;
  }
  /**
   * Locks the active verified actor and captures its display name.
   * @param actor Authenticated identity and current effective permissions.
   * @param transaction Transaction containing the business mutation.
   * @returns The persisted result or completion of the authorized operation.
   */
  async actorName(actor: AccessActor, transaction: Transaction) {
    const [row] = await this.db.query<{ name: string }>(
      "SELECT name FROM users WHERE id=:id AND enabled AND verified FOR SHARE",
      { replacements: { id: actor.id }, transaction, type: QueryTypes.SELECT }
    );
    if (!row) throw new ForbiddenException("Actor is no longer active and verified");
    return row.name;
  }
  /**
   * Computes remaining quota from immutable consumption and reversal evidence.
   * @param membership Patient-global contractual state.
   * @param benefit Current published rule and stable quota dimensions.
   * @param recipient Resolved holder or family member.
   * @param beneficiaryId Selected family member, or omitted for the holder.
   * @param now Current server instant.
   * @param transaction Transaction containing the business mutation.
   * @returns The persisted result or completion of the authorized operation.
   */
  async balance(
    membership: BenefitMembership,
    benefit: BenefitView,
    recipient: BenefitRecipient,
    beneficiaryId: string | null | undefined,
    now: Date,
    transaction: Transaction
  ): Promise<BenefitBalance> {
    const window = benefitWindow(membership.anchorAt, now, benefit.period);
    const [usage] = window
      ? await this.db.query<{ used: number }>(
          `SELECT COALESCE(SUM(c.units),0)::int AS used FROM benefit_consumptions c
       WHERE c."membershipId"=:membershipId AND c."benefitId"=:benefitId AND c."recipientKey"=:recipientKey AND c."windowStart"=:start
       AND NOT EXISTS(SELECT 1 FROM benefit_reversals r WHERE r."consumptionId"=c.id)`,
          {
            replacements: {
              membershipId: membership.id,
              benefitId: benefit.id,
              recipientKey: recipient.key,
              start: window.start
            },
            transaction,
            type: QueryTypes.SELECT
          }
        )
      : [{ used: 0 }];
    const membershipEligible = membershipStatus(membership, now).eligible && membership.patientEnabled;
    const recipientEligible =
      recipient.active &&
      (benefit.audience === "all" || benefit.audience === (beneficiaryId ? "beneficiaries" : "holder"));
    const available = membershipEligible && recipientEligible && !!benefit.currentVersion?.enabled && !!window;
    return {
      benefit,
      membershipEligible,
      recipientEligible,
      windowStart: window?.start ?? null,
      windowEnd: window?.end ?? null,
      usedUnits: usage.used,
      remainingUnits: available ? Math.max(0, benefit.currentVersion!.limitUnits - usage.used) : 0
    };
  }
  /**
   * Validates and coordinates the authorized benefit operation.
   * @param membership Patient-global contractual state.
   * @param now Current server instant.
   */
  requireActive(membership: BenefitMembership, now: Date) {
    if (!membership.patientEnabled || !membershipStatus(membership, now).eligible)
      throw new ConflictException("Membership has no active paid benefit eligibility");
  }
}
