import { AsyncLocalStorage } from "node:async_hooks";
export interface AuditContext {
  requestId: string;
  actorId?: string;
  reason?: string;
}
/** Request-scoped metadata, never the request body, bearer token, URL query or credentials. */
export const auditContext = new AsyncLocalStorage<AuditContext>();
