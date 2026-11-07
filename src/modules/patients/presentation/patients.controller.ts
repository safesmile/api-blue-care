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
import { CrudPatientsUseCase } from "../application/crudPatients.usecase";
import { OwnPatientUseCase } from "../application/ownPatient.usecase";
import { UpdateOwnPatientUseCase } from "../application/updateOwnPatient.usecase";
import { LinkPatientUseCase } from "../application/linkPatient.usecase";
import { AssociatePatientUseCase } from "../application/associatePatient.usecase";
import { ClinicsPatientUseCase } from "../application/clinicsPatient.usecase";
import { DissociatePatientUseCase } from "../application/dissociatePatient.usecase";
import { PatientQueryDto, CreatePatientDto, UpdatePatientDto, OwnPatientDto, LinkPatientDto } from "./patients.dto";
/** Separates owner routes from scoped administrative access. */
@Controller("patients")
export class PatientsController extends CrudEntityController<CrudPatientsUseCase> {
  /**
   * Removes a patient-clinic association without deleting patient data.
   * @param id Patient identifier.
   * @param clinicId Clinic identifier.
   * @param input Optional validated audit reason.
   * @param request Request containing the authenticated identity.
   * @returns Completion of the authorized operation.
   */
  @Delete(":id/clinics/:clinicId") @HttpCode(204) @Permissions(PermissionCode.PatientsUpdate) dissociate(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("clinicId", ParseUUIDPipe) clinicId: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.dissociatePatient.execute(id, clinicId, request.user!);
  }
  /**
   * Recibe las dependencias de la operación.
   * @param patients Dependencia tipada de patients.
   * @param ownPatient Dependencia tipada de ownPatient.
   * @param updateOwnPatient Dependencia tipada de updateOwnPatient.
   * @param linkPatient Dependencia tipada de linkPatient.
   * @param associatePatient Dependencia tipada de associatePatient.
   * @param clinicsPatient Dependencia tipada de clinicsPatient.
   * @param dissociatePatient Dependencia tipada de dissociatePatient.
   */
  constructor(
    patients: CrudPatientsUseCase,
    private readonly ownPatient: OwnPatientUseCase,
    private readonly updateOwnPatient: UpdateOwnPatientUseCase,
    private readonly linkPatient: LinkPatientUseCase,
    private readonly associatePatient: AssociatePatientUseCase,
    private readonly clinicsPatient: ClinicsPatientUseCase,
    private readonly dissociatePatient: DissociatePatientUseCase
  ) {
    super(patients);
  }
  /**
   *
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get("me") @Permissions(PermissionCode.PatientsSelf) own(@Req() request: AuthRequest) {
    return this.ownPatient.execute(request.user!);
  }
  /**
   *
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Patch("me") @Permissions(PermissionCode.PatientsSelf) updateOwn(
    @Body() input: OwnPatientDto,
    @Req() request: AuthRequest
  ) {
    return this.updateOwnPatient.execute(input, request.user!);
  }
  /**
   *
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Post() @Permissions(PermissionCode.PatientsCreate) create(
    @Body() input: CreatePatientDto,
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
  @Get() @Permissions(PermissionCode.PatientsList) list(@Query() query: PatientQueryDto, @Req() request: AuthRequest) {
    return this.crud("list", query, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get(":id") @Permissions(PermissionCode.PatientsRead) read(
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
  @Patch(":id") @Permissions(PermissionCode.PatientsUpdate) update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePatientDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("update", id, input, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Post(":id/account") @Permissions(PermissionCode.PatientsLink) link(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: LinkPatientDto,
    @Req() request: AuthRequest
  ) {
    return this.linkPatient.execute(id, input.userId, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get(":id/clinics") @Permissions(PermissionCode.PatientsRead) clinics(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.clinicsPatient.execute(id, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param clinicId Clinic identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Put(":id/clinics/:clinicId") @HttpCode(204) @Permissions(PermissionCode.PatientsUpdate) associate(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("clinicId", ParseUUIDPipe) clinicId: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.associatePatient.execute(id, clinicId, request.user!);
  }
}
