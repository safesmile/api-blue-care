import { CrudEntityController } from "../../../shared/presentation/crud.controller";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Req } from "@nestjs/common";
import { CrudBenefitsUseCase } from "../application/crudBenefits.usecase";
import { VersionBenefitUseCase } from "../application/versionBenefit.usecase";
import { VersionsBenefitUseCase } from "../application/versionsBenefit.usecase";
import { PublishBenefitUseCase } from "../application/publishBenefit.usecase";
import { FamilySettingsBenefitUseCase } from "../application/familySettingsBenefit.usecase";
import { UpdateFamilySettingsBenefitUseCase } from "../application/updateFamilySettingsBenefit.usecase";
import { CreateBenefitDto, BenefitVersionDto, BenefitQueryDto, FamilySettingsDto } from "./benefits.dto";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
/** Explicit revision and family-limit administration; no mutation of published history. */
@Controller("benefits")
export class BenefitsController extends CrudEntityController<CrudBenefitsUseCase> {
  /**
   * Recibe las dependencias de la operación.
   * @param benefits Dependencia tipada de benefits.
   * @param versionBenefit Dependencia tipada de versionBenefit.
   * @param versionsBenefit Dependencia tipada de versionsBenefit.
   * @param publishBenefit Dependencia tipada de publishBenefit.
   * @param familySettingsBenefit Dependencia tipada de familySettingsBenefit.
   * @param updateFamilySettingsBenefit Dependencia tipada de updateFamilySettingsBenefit.
   */
  constructor(
    benefits: CrudBenefitsUseCase,
    private readonly versionBenefit: VersionBenefitUseCase,
    private readonly versionsBenefit: VersionsBenefitUseCase,
    private readonly publishBenefit: PublishBenefitUseCase,
    private readonly familySettingsBenefit: FamilySettingsBenefitUseCase,
    private readonly updateFamilySettingsBenefit: UpdateFamilySettingsBenefitUseCase
  ) {
    super(benefits);
  }
  /**
   * Creates a stable benefit definition.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post() @Permissions(PermissionCode.BenefitsCreate) create(
    @Body() input: CreateBenefitDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("create", input, request.user);
  }
  /**
   * Lists the authorized benefit catalog.
   * @param query Bounded explicit catalog filters.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get() @Permissions(PermissionCode.BenefitsList) list(@Query() query: BenefitQueryDto, @Req() request: AuthRequest) {
    return this.crud("list", query, request.user);
  }
  /**
   * Reads the configured additional-family limit.
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("plans/:id/family-settings") @Permissions(PermissionCode.BenefitsRead) familySettings(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.familySettingsBenefit.execute(id, request.user);
  }
  /**
   * Changes the family limit without deleting existing relatives.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Put("plans/:id/family-settings") @Permissions(PermissionCode.BenefitsFamilySettings) updateFamilySettings(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: FamilySettingsDto,
    @Req() request: AuthRequest
  ) {
    return this.updateFamilySettingsBenefit.execute(id, input.maxBeneficiaries, request.user);
  }
  /**
   * Reads a benefit definition and its published revision.
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get(":id") @Permissions(PermissionCode.BenefitsRead) read(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.crud("read", id, request.user);
  }
  /**
   * Appends an immutable rule revision.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post(":id/versions") @Permissions(PermissionCode.BenefitsVersion) version(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: BenefitVersionDto,
    @Req() request: AuthRequest
  ) {
    return this.versionBenefit.execute(id, input, request.user);
  }
  /**
   * Lists immutable rule revisions.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get(":id/versions") @Permissions(PermissionCode.BenefitsRead) versions(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.versionsBenefit.execute(id, page, request.user);
  }
  /**
   * Publishes the revision for all current and future members.
   * @param id Resource identifier.
   * @param versionId Immutable rule revision identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post(":id/versions/:versionId/publish") @Permissions(PermissionCode.BenefitsPublish) publish(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.publishBenefit.execute(id, versionId, request.user);
  }
}
