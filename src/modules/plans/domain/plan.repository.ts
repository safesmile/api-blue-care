import type { Page, Pagination } from "../../../shared/domain/crud.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
export interface PlanVersionInput {
  name: string;
  description: string;
  benefitDescriptions?: string[];
  benefitIds?: string[];
  maxBeneficiaries?: number;
  monthlyPriceCents: number;
  annualPriceCents: number;
  taxDisclosure: string;
}
export interface PlanVersion extends Omit<PlanVersionInput, "benefitIds" | "maxBeneficiaries"> {
  id: string;
  planId: string;
  number: number;
  benefitDescriptions: string[];
  benefitIds?: string[] | null;
  maxBeneficiaries?: number | null;
  currency: "GTQ";
  createdAt: Date;
  publishedAt: Date | null;
}
export interface PlanBenefitSummary {
  id: string;
  code: string;
  name: string | null;
  description: string | null;
  enabled: boolean | null;
  kind: "discount" | "service" | "item";
  period: "monthly" | "annual" | "contract";
  audience: "holder" | "beneficiaries" | "all";
  limitUnits: number | null;
  discountBasisPoints: number | null;
}
export interface PlanView {
  id: string;
  code: string;
  enabled: boolean;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  currentVersion: PlanVersion | null;
  benefits?: PlanBenefitSummary[];
  latestDraft?: PlanVersion | null;
  draftBenefits?: PlanBenefitSummary[];
  maxBeneficiaries?: number;
}
/** Versioned commercial catalog. Published history is immutable and never physically deleted. */
export abstract class PlanRepository {
  abstract create(code: string, actor: AccessActor): Promise<PlanView>;
  abstract read(id: string): Promise<PlanView | null>;
  abstract list(page: Pagination, catalog: boolean): Promise<Page<PlanView>>;
  abstract version(
    id: string,
    input: PlanVersionInput & { draftId?: string },
    actor: AccessActor
  ): Promise<PlanVersion>;
  abstract versions(id: string, page: Pagination): Promise<Page<PlanVersion>>;
  abstract publish(id: string, versionId: string, actor: AccessActor): Promise<PlanView>;
  abstract update(id: string, enabled: boolean, actor: AccessActor): Promise<PlanView>;
  abstract assignBenefit(id: string, benefitId: string, assigned: boolean, actor: AccessActor): Promise<void>;
}
