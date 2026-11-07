import { PermissionCode } from "../../../shared/domain/permission-code";
import { Controller, Get, Query, Req } from "@nestjs/common";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { UpcomingDashboardUseCase } from "../application/upcomingDashboard.usecase";
import { MetricsDashboardUseCase } from "../application/metricsDashboard.usecase";
import { ExpiringDashboardUseCase } from "../application/expiringDashboard.usecase";
import { DashboardQueryDto } from "./dashboard.dto";
/** Backend metrics and expiring lists for a future administration screen. */
@Controller("dashboard")
export class DashboardController {
  /**
   * Recibe las dependencias de la operación.
   * @param upcomingDashboard Dependencia tipada de upcomingDashboard.
   * @param metricsDashboard Dependencia tipada de metricsDashboard.
   * @param expiringDashboard Dependencia tipada de expiringDashboard.
   */
  constructor(
    private readonly upcomingDashboard: UpcomingDashboardUseCase,
    private readonly metricsDashboard: MetricsDashboardUseCase,
    private readonly expiringDashboard: ExpiringDashboardUseCase
  ) {}
  /**
   * Reads aggregate metrics in a consistent clinic-scoped snapshot.
   * @param query Bounded explicit query filters.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get() @Permissions(PermissionCode.DashboardRead) metrics(
    @Query() query: DashboardQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.metricsDashboard.execute(query, request.user);
  }
  /**
   * Lists paid active memberships approaching expiration.
   * @param query Bounded explicit query filters.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get("memberships/expiring") @Permissions(PermissionCode.DashboardRead) expiring(
    @Query() query: DashboardQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.expiringDashboard.execute(query, request.user);
  }
  /**
   * Lists upcoming prevention within the dashboard scope.
   * @param query Bounded explicit query filters.
   * @param request Authenticated HTTP request.
   * @returns The authorized result or completion of the operation.
   */
  @Get("prevention/upcoming") @Permissions(PermissionCode.DashboardRead) upcoming(
    @Query() query: DashboardQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.upcomingDashboard.execute(query, request.user);
  }
}
