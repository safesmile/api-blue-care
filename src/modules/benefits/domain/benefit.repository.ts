import type { Page, Pagination } from "../../../shared/domain/crud.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
export type BenefitKind = "discount" | "service" | "item";
export type BenefitPeriod = "monthly" | "annual" | "contract";
export type BenefitAudience = "holder" | "beneficiaries" | "all";
export interface BenefitInput {
  planId: string;
  code: string;
  kind: BenefitKind;
  period: BenefitPeriod;
  audience: BenefitAudience;
}
export interface BenefitVersionInput {
  name: string;
  description: string;
  limitUnits: number;
  discountBasisPoints?: number | null;
  enabled: boolean;
}
export interface BenefitVersion extends BenefitVersionInput {
  id: string;
  benefitId: string;
  number: number;
  createdAt: Date;
  publishedAt: Date | null;
}
export interface BenefitView extends BenefitInput {
  id: string;
  createdAt: Date;
  currentVersionId: string | null;
  currentVersion: BenefitVersion | null;
}
export interface BenefitQuery extends Pagination {
  planId?: string;
}
/** Stable quota dimensions and immutable revisions prevent publication from resetting used balances. */
export abstract class BenefitRepository {
  abstract create(input: BenefitInput, actor: AccessActor): Promise<BenefitView>;
  abstract read(id: string): Promise<BenefitView | null>;
  abstract list(query: BenefitQuery): Promise<Page<BenefitView>>;
  abstract version(id: string, input: BenefitVersionInput, actor: AccessActor): Promise<BenefitVersion>;
  abstract versions(id: string, page: Pagination): Promise<Page<BenefitVersion>>;
  abstract publish(id: string, versionId: string, actor: AccessActor): Promise<BenefitView>;
  abstract familySettings(planId: string): Promise<{ planId: string; maxBeneficiaries: number }>;
  abstract updateFamilySettings(
    planId: string,
    maxBeneficiaries: number,
    actor: AccessActor
  ): Promise<{ planId: string; maxBeneficiaries: number }>;
}
