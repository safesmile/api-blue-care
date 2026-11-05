import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { AUTHORIZATION_PERMISSIONS } from "../domain/authorization.permissions";
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put, Post, Query, Req } from "@nestjs/common";
import { RolesUseCase } from "../application/roles.usecase";
import { RoleDto } from "./role.dto";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { PaginationDto } from "../../identity/presentation/user.dto";
/** Explicit administrative role endpoints, each with an operation permission. */
@Controller("roles")
export class RolesController {
  /**
   *
   * @param roles Role definitions or assigned role names.
   * @returns Result of the completed operation.
   */
  constructor(private readonly roles: RolesUseCase) {}
  /**
   *
   * @param page Bounded pagination settings.
   * @param req HTTP request with the authenticated identity.
   * @returns Result of the completed operation.
   */
  @Get() @Permissions(AUTHORIZATION_PERMISSIONS.list.shortcode) list(
    @Query() page: PaginationDto,
    @Req() req: AuthRequest
  ) {
    return this.roles.list(page, req.user);
  }
  /**
   *
   * @param id Resource identifier.
   * @param req HTTP request with the authenticated identity.
   * @returns Result of the completed operation.
   */
  @Get(":id") @Permissions(AUTHORIZATION_PERMISSIONS.read.shortcode) read(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthRequest
  ) {
    return this.roles.read(id, req.user);
  }
  /**
   *
   * @param input Validated definition for this operation.
   * @param req HTTP request with the authenticated identity.
   * @returns Result of the completed operation.
   */
  @Post() @Permissions(AUTHORIZATION_PERMISSIONS.create.shortcode) create(
    @Body() input: RoleDto,
    @Req() req: AuthRequest
  ) {
    return this.roles.create(input, req.user);
  }
  /**
   *
   * @param id Resource identifier.
   * @param input Validated definition for this operation.
   * @param req HTTP request with the authenticated identity.
   * @returns Result of the completed operation.
   */
  @Put(":id") @Permissions(AUTHORIZATION_PERMISSIONS.update.shortcode) update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: RoleDto,
    @Req() req: AuthRequest
  ) {
    return this.roles.update(id, input, req.user);
  }
  /**
   *
   * @param id Resource identifier.
   * @param req HTTP request with the authenticated identity.
   * @param _input Validated optional audit reason.
   * @returns Result of the completed operation.
   */
  @Delete(":id") @HttpCode(204) @Permissions(AUTHORIZATION_PERMISSIONS.delete.shortcode) delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
    @Body() _input: AuditReasonDto = {}
  ) {
    void _input; // The validated body supplies only the optional audit reason.
    return this.roles.delete(id, req.user);
  }
}
