import type { Page, Pagination } from "../../../shared/domain/crud.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import type { PlanVersion } from "../../plans/domain/plan.repository";
export type Cadence = "monthly" | "annual";
export interface MembershipInput {
  patientId: string;
  planVersionId: string;
  cadence: Cadence;
}
export interface MembershipRecord {
  id: string;
  patientId: string;
  planVersionId: string;
  cadence: Cadence;
  amountCents: number;
  currency: "GTQ";
  createdAt: Date;
  anchorAt: Date | null;
  periodStart: Date | null;
  paidThrough: Date | null;
  periodsCount: number;
  suspendedAt: Date | null;
  cancelRequestedAt: Date | null;
  stoppedAt: Date | null;
  closedAt: Date | null;
  subscriptionId: string | null;
  checkoutId: string | null;
  checkoutUrl: string | null;
  checkoutStatus: string;
  checkoutStartedAt: Date | null;
  checkoutExpiresAt: Date | null;
}
export interface MembershipView extends MembershipRecord {
  billingSync: "review" | "pending" | "stopped" | "paused" | "active" | "not-started";
  status: "pending" | "active" | "expired" | "suspended" | "cancelled";
  eligible: boolean;
  contractedVersion: PlanVersion;
  currentBenefits: Pick<
    PlanVersion,
    "id" | "number" | "name" | "description" | "benefitDescriptions" | "publishedAt"
  > | null;
}
export interface MembershipQuery extends Pagination {
  patientId?: string;
}
export interface MembershipPeriod {
  id: string;
  membershipId: string;
  paymentId: string;
  number: number;
  amountCents: number;
  currency: string;
  paidAt: Date;
  startsAt: Date;
  endsAt: Date;
  recordedAt: Date;
}
/** Patient-global contracts with scoped administration and distinct owner access. */
export abstract class MembershipRepository {
  abstract create(input: MembershipInput, actor: AccessActor, own: boolean): Promise<MembershipView>;
  abstract read(id: string, actor: AccessActor, own: boolean): Promise<MembershipView | null>;
  abstract list(query: MembershipQuery, actor: AccessActor, own: boolean): Promise<Page<MembershipView>>;
  abstract cancel(id: string, actor: AccessActor, own: boolean): Promise<MembershipView>;
  abstract suspend(id: string, actor: AccessActor): Promise<MembershipView>;
  abstract periods(id: string, page: Pagination, actor: AccessActor, own: boolean): Promise<Page<MembershipPeriod>>;
}
