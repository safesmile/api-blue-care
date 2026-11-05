import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from "@nestjs/common";
import { PlansUseCase } from "../application/plans.usecase";
import { CreatePlanDto, PlanVersionDto, UpdatePlanDto } from "./plans.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
/** Explicit version creation and publication with a separate account-facing catalog. */
@Controller("plans")
export class PlansController {
  /**
   * Receives the persistence and policy boundaries.
   * @param plans Versioned plan repository port.
   */
  constructor(private readonly plans: PlansUseCase) {}
  /**
   * Lists published plans available for new contracts.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("catalog") @Permissions("plans:catalog") catalog(@Query() page: PaginationDto, @Req() request: AuthRequest) {
    return this.plans.catalog(page, request.user);
  }
  /**
   * Creates an explicitly authorized pending record.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post() @Permissions("plans:create") create(@Body() input: CreatePlanDto, @Req() request: AuthRequest) {
    return this.plans.create(input.code, request.user);
  }
  /**
   * Returns a bounded page within the caller scope.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get() @Permissions("plans:list") list(@Query() page: PaginationDto, @Req() request: AuthRequest) {
    return this.plans.list(page, request.user);
  }
  /**
   * Reads one authorized resource without changing its state.
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get(":id") @Permissions("plans:read") read(@Param("id", ParseUUIDPipe) id: string, @Req() request: AuthRequest) {
    return this.plans.read(id, request.user);
  }
  /**
   * Appends an immutable commercial revision.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post(":id/versions") @Permissions("plans:version") version(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PlanVersionDto,
    @Req() request: AuthRequest
  ) {
    return this.plans.version(id, input, request.user);
  }
  /**
   * Lists immutable commercial history.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get(":id/versions") @Permissions("plans:read") versions(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.plans.versions(id, page, request.user);
  }
  /**
   * Publishes a new revision without rewriting existing contracts.
   * @param id Resource identifier.
   * @param versionId Immutable plan revision identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post(":id/versions/:versionId/publish") @Permissions("plans:publish") publish(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.plans.publish(id, versionId, request.user);
  }
  /**
   * Changes whether a plan accepts new contracts.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Patch(":id") @Permissions("plans:update") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePlanDto,
    @Req() request: AuthRequest
  ) {
    return this.plans.update(id, input.enabled, request.user);
  }
}
