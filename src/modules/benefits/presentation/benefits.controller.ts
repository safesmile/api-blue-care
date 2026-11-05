import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Req } from "@nestjs/common";
import { BenefitsUseCase } from "../application/benefits.usecase";
import { CreateBenefitDto, BenefitVersionDto, BenefitQueryDto, FamilySettingsDto } from "./benefits.dto";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
/** Explicit revision and family-limit administration; no mutation of published history. */
@Controller("benefits")
export class BenefitsController {
  /**
   * Initializes the benefit service dependencies.
   * @param benefits Benefit configuration repository or application service.
   */
  constructor(private readonly benefits: BenefitsUseCase) {}
  /**
   * Creates a stable benefit definition.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post() @Permissions("benefits:create") create(@Body() input: CreateBenefitDto, @Req() request: AuthRequest) {
    return this.benefits.create(input, request.user);
  }
  /**
   * Lists the authorized benefit catalog.
   * @param query Bounded explicit catalog filters.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get() @Permissions("benefits:list") list(@Query() query: BenefitQueryDto, @Req() request: AuthRequest) {
    return this.benefits.list(query, request.user);
  }
  /**
   * Reads the configured additional-family limit.
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("plans/:id/family-settings") @Permissions("benefits:read") familySettings(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.benefits.familySettings(id, request.user);
  }
  /**
   * Changes the family limit without deleting existing relatives.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Put("plans/:id/family-settings") @Permissions("benefits:family-settings") updateFamilySettings(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: FamilySettingsDto,
    @Req() request: AuthRequest
  ) {
    return this.benefits.updateFamilySettings(id, input.maxBeneficiaries, request.user);
  }
  /**
   * Reads a benefit definition and its published revision.
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get(":id") @Permissions("benefits:read") read(@Param("id", ParseUUIDPipe) id: string, @Req() request: AuthRequest) {
    return this.benefits.read(id, request.user);
  }
  /**
   * Appends an immutable rule revision.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post(":id/versions") @Permissions("benefits:version") version(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: BenefitVersionDto,
    @Req() request: AuthRequest
  ) {
    return this.benefits.version(id, input, request.user);
  }
  /**
   * Lists immutable rule revisions.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get(":id/versions") @Permissions("benefits:read") versions(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.benefits.versions(id, page, request.user);
  }
  /**
   * Publishes the revision for all current and future members.
   * @param id Resource identifier.
   * @param versionId Immutable rule revision identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post(":id/versions/:versionId/publish") @Permissions("benefits:publish") publish(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.benefits.publish(id, versionId, request.user);
  }
}
