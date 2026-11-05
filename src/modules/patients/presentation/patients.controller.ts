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
import { PatientsUseCase } from "../application/patients.usecase";
import { PatientQueryDto, CreatePatientDto, UpdatePatientDto, OwnPatientDto, LinkPatientDto } from "./patients.dto";
/** Separates owner routes from scoped administrative access. */
@Controller("patients")
export class PatientsController {
  /**
   * Removes a patient-clinic association without deleting patient data.
   * @param id Patient identifier.
   * @param clinicId Clinic identifier.
   * @param input Optional validated audit reason.
   * @param request Request containing the authenticated identity.
   * @returns Completion of the authorized operation.
   */
  @Delete(":id/clinics/:clinicId") @HttpCode(204) @Permissions("patients:update") dissociate(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("clinicId", ParseUUIDPipe) clinicId: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.patients.dissociate(id, clinicId, request.user!);
  }
  /**
   *
   * @param patients Patient repository port.
   */
  constructor(private readonly patients: PatientsUseCase) {}
  /**
   *
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get("me") @Permissions("patients:self") own(@Req() request: AuthRequest) {
    return this.patients.own(request.user!);
  }
  /**
   *
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Patch("me") @Permissions("patients:self") updateOwn(@Body() input: OwnPatientDto, @Req() request: AuthRequest) {
    return this.patients.updateOwn(input, request.user!);
  }
  /**
   *
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Post() @Permissions("patients:create") create(@Body() input: CreatePatientDto, @Req() request: AuthRequest) {
    return this.patients.create(input, request.user!);
  }
  /**
   *
   * @param query Bounded search and status filters.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get() @Permissions("patients:list") list(@Query() query: PatientQueryDto, @Req() request: AuthRequest) {
    return this.patients.list(query, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get(":id") @Permissions("patients:read") read(@Param("id", ParseUUIDPipe) id: string, @Req() request: AuthRequest) {
    return this.patients.read(id, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Patch(":id") @Permissions("patients:update") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePatientDto,
    @Req() request: AuthRequest
  ) {
    return this.patients.update(id, input, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Post(":id/account") @Permissions("patients:link") link(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: LinkPatientDto,
    @Req() request: AuthRequest
  ) {
    return this.patients.link(id, input.userId, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get(":id/clinics") @Permissions("patients:read") clinics(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.patients.clinics(id, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param clinicId Clinic identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Put(":id/clinics/:clinicId") @HttpCode(204) @Permissions("patients:update") associate(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("clinicId", ParseUUIDPipe) clinicId: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.patients.associate(id, clinicId, request.user!);
  }
}
