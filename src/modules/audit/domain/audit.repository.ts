import type { AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
export type AuditValue = string | number | boolean | null | AuditValue[] | { [key: string]: AuditValue };
export type AuditSnapshot = Record<string, AuditValue>;
export interface AuditRecord {
  id: string;
  occurredAt: Date;
  requestId: string;
  actorId: string | null;
  actorType: "user" | "system";
  actorName: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string | null;
  before: AuditSnapshot | null;
  after: AuditSnapshot | null;
}
export interface AuditQuery extends Pagination {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  from?: string;
  to?: string;
}
/** Read-only audit boundary: mutations are written with the originating resource transaction. */
export abstract class AuditRepository {
  abstract list(query: AuditQuery, actor: AccessActor): Promise<{ items: AuditRecord[]; total: number }>;
  abstract read(id: string, actor: AccessActor): Promise<AuditRecord | null>;
}
