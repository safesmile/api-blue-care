import { ListQueryDto } from "../../../shared/presentation/list-query.dto";
import { CrudEntityController } from "../../../shared/presentation/crud.controller";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { CrudPlansUseCase } from "../application/crudPlans.usecase";
import { CatalogPlanUseCase } from "../application/catalogPlan.usecase";
import { VersionPlanUseCase } from "../application/versionPlan.usecase";
import { VersionsPlanUseCase } from "../application/versionsPlan.usecase";
import { PublishPlanUseCase } from "../application/publishPlan.usecase";
import { AssignPlanBenefitDto, CreatePlanDto, PlanVersionDto, UpdatePlanDto } from "./plans.dto";
import { AssignPlanBenefitUseCase } from "../application/assignPlanBenefit.usecase";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
/** Explicit version creation and publication with a separate account-facing catalog. */
@Controller("plans")
export class PlansController extends CrudEntityController<CrudPlansUseCase> {
  /**
   * Recibe las dependencias de la operación.
   * @param plans Dependencia tipada de plans.
   * @param catalogPlan Dependencia tipada de catalogPlan.
   * @param versionPlan Dependencia tipada de versionPlan.
   * @param versionsPlan Dependencia tipada de versionsPlan.
   * @param publishPlan Dependencia tipada de publishPlan.
   * @param assignPlanBenefit Operación de asignación de beneficios.
   */
  constructor(
    plans: CrudPlansUseCase,
    private readonly catalogPlan: CatalogPlanUseCase,
    private readonly versionPlan: VersionPlanUseCase,
    private readonly versionsPlan: VersionsPlanUseCase,
    private readonly publishPlan: PublishPlanUseCase,
    private readonly assignPlanBenefit: AssignPlanBenefitUseCase
  ) {
    super(plans);
  }
  /**
   * Lists published plans available for new contracts.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("catalog") @Permissions(PermissionCode.PlansCatalog) catalog(
    @Query() page: ListQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.catalogPlan.execute(page, request.user);
  }
  /**
   * Creates an explicitly authorized pending record.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post() @Permissions(PermissionCode.PlansCreate) create(@Body() input: CreatePlanDto, @Req() request: AuthRequest) {
    return this.crud("create", input.code, request.user);
  }
  /**
   * Returns a bounded page within the caller scope.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get() @Permissions(PermissionCode.PlansList) list(@Query() page: ListQueryDto, @Req() request: AuthRequest) {
    return this.crud("list", page, request.user);
  }
  /**
   * Reads one authorized resource without changing its state.
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get(":id") @Permissions(PermissionCode.PlansRead) read(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.crud("read", id, request.user);
  }
  /**
   * Creates a commercial draft.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post(":id/versions") @Permissions(PermissionCode.PlansVersion) version(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PlanVersionDto,
    @Req() request: AuthRequest
  ) {
    return this.versionPlan.execute(id, input, request.user);
  }
  /**
   * Saves changes to an unpublished revision.
   * @param id Resource identifier.
   * @param draftId Draft revision identifier.
   * @param input Validated revision fields.
   * @param request Request containing the authenticated identity.
   * @returns Updated draft.
   */
  @Patch(":id/versions/:draftId") @Permissions(PermissionCode.PlansVersion) updateDraft(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("draftId", ParseUUIDPipe) draftId: string,
    @Body() input: PlanVersionDto,
    @Req() request: AuthRequest
  ) {
    return this.versionPlan.execute(id, { ...input, draftId }, request.user);
  }
  /**
   * Lists commercial drafts and published history.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get(":id/versions") @Permissions(PermissionCode.PlansRead) versions(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.versionsPlan.execute(id, page, request.user);
  }
  /**
   * Publishes a new revision without rewriting existing contracts.
   * @param id Resource identifier.
   * @param versionId Immutable plan revision identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post(":id/versions/:versionId/publish") @Permissions(PermissionCode.PlansPublish) publish(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.publishPlan.execute(id, versionId, request.user);
  }
  /**
   * Changes whether a plan accepts new contracts.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Patch(":id") @Permissions(PermissionCode.PlansUpdate) update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePlanDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("update", id, input.enabled, request.user);
  }
  /**
   * Updates a catalog benefit assignment for the plan.
   * @param id Plan identifier.
   * @param benefitId Benefit identifier.
   * @param input Desired assignment state.
   * @param request Authenticated request.
   * @returns Completion of the change.
   */
  @Put(":id/benefits/:benefitId") @HttpCode(204) @Permissions(PermissionCode.PlansUpdate) assignBenefit(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("benefitId", ParseUUIDPipe) benefitId: string,
    @Body() input: AssignPlanBenefitDto,
    @Req() request: AuthRequest
  ) {
    return this.assignPlanBenefit.execute(id, benefitId, input.assigned, request.user);
  }
}
