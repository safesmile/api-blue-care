import type { Page, Pagination } from "../../../shared/domain/crud.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
export interface PlanVersionInput {
  name: string;
  description: string;
  benefitDescriptions: string[];
  monthlyPriceCents: number;
  taxDisclosure: string;
}
export interface PlanVersion extends PlanVersionInput {
  id: string;
  planId: string;
  number: number;
  annualPriceCents: number;
  currency: "GTQ";
  createdAt: Date;
  publishedAt: Date | null;
}
export interface PlanView {
  id: string;
  code: string;
  enabled: boolean;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  currentVersion: PlanVersion | null;
}
/** Versioned commercial catalog. Published history is immutable and never physically deleted. */
export abstract class PlanRepository {
  abstract create(code: string, actor: AccessActor): Promise<PlanView>;
  abstract read(id: string): Promise<PlanView | null>;
  abstract list(page: Pagination, catalog: boolean): Promise<Page<PlanView>>;
  abstract version(id: string, input: PlanVersionInput, actor: AccessActor): Promise<PlanVersion>;
  abstract versions(id: string, page: Pagination): Promise<Page<PlanVersion>>;
  abstract publish(id: string, versionId: string, actor: AccessActor): Promise<PlanView>;
  abstract update(id: string, enabled: boolean, actor: AccessActor): Promise<PlanView>;
}
