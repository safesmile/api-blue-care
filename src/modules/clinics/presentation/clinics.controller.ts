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
import { ClinicsUseCase } from "../application/clinics.usecase";
import { ClinicQueryDto, CreateClinicDto, UpdateClinicDto } from "./clinics.dto";
/** Explicit clinic catalog and staff-assignment routes. */
@Controller("clinics")
export class ClinicsController {
  /**
   *
   * @param clinics Clinic repository port.
   */
  constructor(private readonly clinics: ClinicsUseCase) {}
  /**
   *
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Post() @Permissions("clinics:create") create(@Body() input: CreateClinicDto, @Req() request: AuthRequest) {
    return this.clinics.create(input, request.user!);
  }
  /**
   *
   * @param query Bounded search and status filters.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get() @Permissions("clinics:list") list(@Query() query: ClinicQueryDto, @Req() request: AuthRequest) {
    return this.clinics.list(query, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get(":id") @Permissions("clinics:read") read(@Param("id", ParseUUIDPipe) id: string, @Req() request: AuthRequest) {
    return this.clinics.read(id, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Patch(":id") @Permissions("clinics:update") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateClinicDto,
    @Req() request: AuthRequest
  ) {
    return this.clinics.update(id, input, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param page Bounded pagination.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Get(":id/staff") @Permissions("clinics:staff-list") staff(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.clinics.staff(id, page, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Put(":id/staff/:userId") @HttpCode(204) @Permissions("clinics:staff-manage") assign(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.clinics.assign(id, userId, request.user!);
  }
  /**
   *
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The result of the authorized resource operation.
   */
  @Delete(":id/staff/:userId") @HttpCode(204) @Permissions("clinics:staff-manage") unassign(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.clinics.unassign(id, userId, request.user!);
  }
}
