import type { AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
export interface DashboardQuery extends Pagination {
  days: number;
  clinicId?: string;
}
export interface DashboardMetrics {
  asOf: Date;
  until: Date;
  activeMembers: number;
  expiringMemberships: number;
  upcomingPreventiveEvents: number;
  overduePreventiveEvents: number;
}
export interface ExpiringMembership {
  id: string;
  patientId: string;
  patientName: string;
  paidThrough: Date;
  cancelRequested: boolean;
}
/** Read models use the same eligibility and clinic boundaries as their source modules. */
export abstract class DashboardRepository {
  /**
   * Reads aggregate metrics in a consistent clinic-scoped snapshot.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and effective permissions.
   */
  abstract upcoming(
    query: DashboardQuery,
    actor: AccessActor
  ): Promise<{
    asOf: Date;
    until: Date;
    items: {
      id: string;
      patientId: string;
      patientName: string;
      clinicId: string;
      typeName: string;
      dueAt: Date;
      status: string;
    }[];
    total: number;
  }>;
  abstract metrics(query: DashboardQuery, actor: AccessActor): Promise<DashboardMetrics>;
  /**
   * Lists paid active memberships approaching expiration.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and effective permissions.
   */
  abstract expiring(
    query: DashboardQuery,
    actor: AccessActor
  ): Promise<{ asOf: Date; until: Date; items: ExpiringMembership[]; total: number }>;
}
