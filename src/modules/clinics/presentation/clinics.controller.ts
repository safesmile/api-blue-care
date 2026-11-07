import { CrudEntityController } from "../../../shared/presentation/crud.controller";
import { PermissionCode } from "../../../shared/domain/permission-code";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req
} from "@nestjs/common";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { AvailableClinicUseCase } from "../application/availableClinic.usecase";
import { CrudClinicsUseCase } from "../application/crudClinics.usecase";
import { StaffClinicUseCase } from "../application/staffClinic.usecase";
import { AssignClinicUseCase } from "../application/assignClinic.usecase";
import { UnassignClinicUseCase } from "../application/unassignClinic.usecase";
import { AssignClinicStaffDto, ClinicQueryDto, CreateClinicDto, UpdateClinicDto } from "./clinics.dto";
/** Explicit clinic catalog and staff-assignment routes. */
@Controller("clinics")
export class ClinicsController extends CrudEntityController<CrudClinicsUseCase> {
  /**
   * Recibe las dependencias de la operación.
   * @param availableClinic Dependencia tipada de availableClinic.
   * @param clinics Dependencia tipada de clinics.
   * @param staffClinic Dependencia tipada de staffClinic.
   * @param assignClinic Dependencia tipada de assignClinic.
   * @param unassignClinic Dependencia tipada de unassignClinic.
   */
  constructor(
    private readonly availableClinic: AvailableClinicUseCase,
    clinics: CrudClinicsUseCase,
    private readonly staffClinic: StaffClinicUseCase,
    private readonly assignClinic: AssignClinicUseCase,
    private readonly unassignClinic: UnassignClinicUseCase
  ) {
    super(clinics);
  }
  /**
   * Lists metadata for assigning staff, separately from the signed clinical data context.
   * @param query Bounded explicit query filters.
   * @param request Authenticated request and session context.
   * @returns The authorized result or completion of the operation.
   */
  @Get("available") @Permissions(PermissionCode.ClinicsStaffManage) available(
    @Query() query: ClinicQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.availableClinic.execute(query, request.user);
  }
  /**
   *
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Post() @Permissions(PermissionCode.ClinicsCreate) create(
    @Body() input: CreateClinicDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("create", input, request.user!);
  }
  /**
   *
   * @param query Bounded search and status filters.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get() @Permissions(PermissionCode.ClinicsList) list(@Query() query: ClinicQueryDto, @Req() request: AuthRequest) {
    return this.crud("list", query, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get(":id") @Permissions(PermissionCode.ClinicsRead) read(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.crud("read", id, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Patch(":id") @Permissions(PermissionCode.ClinicsUpdate) update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateClinicDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("update", id, input, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param page Bounded pagination.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get(":id/staff") @Permissions(PermissionCode.ClinicsStaffList) staff(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.staffClinic.execute(id, page, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Put(":id/staff/:userId") @HttpCode(204) @Permissions(PermissionCode.ClinicsStaffManage) assign(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: AssignClinicStaffDto,
    @Req() request: AuthRequest
  ) {
    return this.assignClinic.execute(id, userId, request.user!, input.roles);
  }
  /**
   *
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Delete(":id/staff/:userId") @HttpCode(204) @Permissions(PermissionCode.ClinicsStaffManage) unassign(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.unassignClinic.execute(id, userId, request.user!);
  }
}
