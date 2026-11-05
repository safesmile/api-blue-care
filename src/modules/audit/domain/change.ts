import type { AuditSnapshot } from "./audit.repository";
import type { NotificationInput } from "../../notifications/domain/notification.repository";
export interface ChangeInput {
  action: string;
  resourceType: string;
  resourceId: string;
  actorId?: string | null;
  before?: AuditSnapshot | null;
  after?: AuditSnapshot | null;
  reason?: string;
  notifications?: Omit<NotificationInput, "key">[];
}
