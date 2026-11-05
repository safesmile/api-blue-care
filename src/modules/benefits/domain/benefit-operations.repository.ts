import type { Page, Pagination } from "../../../shared/domain/crud.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import type { BenefitView } from "./benefit.repository";
export interface BeneficiaryInput {
  firstName: string;
  lastName: string;
  birthDate?: string | null;
}
export interface BeneficiaryView extends BeneficiaryInput {
  id: string;
  slotId: string;
  number: number;
  createdAt: Date;
  lockedUntil: Date;
}
export interface BenefitBalance {
  benefit: BenefitView;
  membershipEligible: boolean;
  recipientEligible: boolean;
  windowStart: Date | null;
  windowEnd: Date | null;
  usedUnits: number;
  remainingUnits: number;
}
export interface ConsumptionInput {
  membershipId: string;
  benefitId: string;
  beneficiaryId?: string | null;
  clinicId: string;
  units: number;
  serviceReference: string;
  idempotencyKey: string;
}
export interface TicketInput {
  benefitId: string;
  beneficiaryId?: string | null;
  units: number;
}
export interface TicketConsumptionInput {
  token: string;
  clinicId: string;
  serviceReference: string;
  idempotencyKey: string;
}
export interface ConsumptionView {
  id: string;
  membershipId: string;
  benefitId: string;
  benefitVersionId: string;
  beneficiaryId: string | null;
  recipientKey: string;
  recipientName: string;
  clinicId: string;
  clinicName: string;
  performedBy: string;
  actorName: string;
  units: number;
  limitSnapshot: number;
  discountBasisPoints: number | null;
  windowStart: Date;
  windowEnd: Date | null;
  occurredAt: Date;
  serviceReference: string;
  idempotencyKey: string;
  ticketId: string | null;
  reversed: boolean;
}
export interface ReversalView {
  id: string;
  consumptionId: string;
  performedBy: string;
  actorName: string;
  reason: string;
  occurredAt: Date;
  idempotencyKey: string;
}
/** Explicit authorized operations. No client can set a balance, period, actor or consumption timestamp. */
export abstract class BenefitOperationsRepository {
  abstract family(id: string, page: Pagination, actor: AccessActor, own: boolean): Promise<Page<BeneficiaryView>>;
  abstract addBeneficiary(
    id: string,
    input: BeneficiaryInput,
    actor: AccessActor,
    own: boolean
  ): Promise<BeneficiaryView>;
  abstract replaceBeneficiary(
    id: string,
    beneficiaryId: string,
    input: BeneficiaryInput,
    actor: AccessActor,
    own: boolean
  ): Promise<BeneficiaryView>;
  abstract balances(
    id: string,
    beneficiaryId: string | undefined,
    page: Pagination,
    actor: AccessActor,
    own: boolean
  ): Promise<Page<BenefitBalance>>;
  abstract issueTicket(
    id: string,
    input: TicketInput,
    actor: AccessActor
  ): Promise<{ id: string; token: string; expiresAt: Date }>;
  abstract consume(input: ConsumptionInput, actor: AccessActor): Promise<ConsumptionView>;
  abstract consumeTicket(input: TicketConsumptionInput, actor: AccessActor): Promise<ConsumptionView>;
  abstract reverse(id: string, reason: string, idempotencyKey: string, actor: AccessActor): Promise<ReversalView>;
  abstract clinicHistory(id: string, page: Pagination, actor: AccessActor): Promise<Page<ConsumptionView>>;
  abstract history(id: string, page: Pagination, actor: AccessActor, own: boolean): Promise<Page<ConsumptionView>>;
}
