import { Controller, Get, Query, Req } from "@nestjs/common";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { DashboardUseCase } from "../application/dashboard.usecase";
import { DashboardQueryDto } from "./dashboard.dto";
/** Backend metrics and expiring lists for a future administration screen. */
@Controller("dashboard")
export class DashboardController {
  /**
   * Receives the explicit persistence and transport dependencies.
   * @param dashboard Explicit dashboard value for this operation.
   */
  constructor(private readonly dashboard: DashboardUseCase) {}
  /**
   * Reads aggregate metrics in a consistent clinic-scoped snapshot.
   * @param query Bounded explicit query filters.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get() @Permissions("dashboard:read") metrics(@Query() query: DashboardQueryDto, @Req() request: AuthRequest) {
    return this.dashboard.metrics(query, request.user);
  }
  /**
   * Lists paid active memberships approaching expiration.
   * @param query Bounded explicit query filters.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get("memberships/expiring") @Permissions("dashboard:read") expiring(
    @Query() query: DashboardQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.dashboard.expiring(query, request.user);
  }
  /**
   * Lists upcoming prevention within the dashboard scope.
   * @param query Bounded explicit query filters.
   * @param request Authenticated HTTP request.
   * @returns The authorized result or completion of the operation.
   */
  @Get("prevention/upcoming") @Permissions("dashboard:read") upcoming(
    @Query() query: DashboardQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.dashboard.upcoming(query, request.user);
  }
}
