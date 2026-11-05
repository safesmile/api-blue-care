import { ForbiddenException, Injectable } from "@nestjs/common";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import { DashboardRepository, type DashboardQuery } from "../domain/dashboard.repository";
/** Administrative aggregates never replace operation permissions on individual resources. */
@Injectable()
export class DashboardUseCase {
  /**
   * Receives the explicit persistence and transport dependencies.
   * @param repository Persistence boundary.
   */
  constructor(private readonly repository: DashboardRepository) {}
  /**
   * Lists the same upcoming records represented by the dashboard counter.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  upcoming(query: DashboardQuery, actor: AccessActor) {
    this.require(actor, "dashboard:read");
    return this.repository.upcoming(query, actor);
  }
  /**
   * Reads aggregate metrics in a consistent clinic-scoped snapshot.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  metrics(query: DashboardQuery, actor: AccessActor) {
    this.require(actor, "dashboard:read");
    return this.repository.metrics(query, actor);
  }
  /**
   * Lists paid active memberships approaching expiration.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  expiring(query: DashboardQuery, actor: AccessActor) {
    this.require(actor, "dashboard:read");
    return this.repository.expiring(query, actor);
  }
  /**
   * Requires the explicit operation permission.
   * @param actor Authenticated caller and effective permissions.
   * @param permission Explicit permission value for this operation.
   */
  private require(actor: AccessActor, permission: import("../../../shared/domain/permission").Permission) {
    if (!AccessPolicy.allows(actor, permission)) throw new ForbiddenException("Missing operation permission");
  }
}
