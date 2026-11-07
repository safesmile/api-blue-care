import { CrudEntityController } from "../../../shared/presentation/crud.controller";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { IDENTITY_PERMISSIONS } from "../domain/identity.permissions";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from "@nestjs/common";
import { CollaboratorsUserUseCase } from "../application/collaboratorsUser.usecase";
import { CollaboratorUserUseCase } from "../application/collaboratorUser.usecase";
import { CrudUsersUseCase } from "../application/crudUsers.usecase";
import { CreateUserDto, UpdateUserDto, PaginationDto } from "./user.dto";
import { Permissions } from "../../auth/presentation/auth.decorators";
/**
 * Exposes explicit user CRUD routes and their required permissions.
 */
@Controller("users")
export class UsersController extends CrudEntityController<CrudUsersUseCase> {
  /**
   * Recibe las dependencias de la operación.
   * @param collaboratorsUser Dependencia tipada de collaboratorsUser.
   * @param collaboratorUser Dependencia tipada de collaboratorUser.
   * @param users Dependencia tipada de users.
   */
  constructor(
    private readonly collaboratorsUser: CollaboratorsUserUseCase,
    private readonly collaboratorUser: CollaboratorUserUseCase,
    users: CrudUsersUseCase
  ) {
    super(users);
  }
  /**
   * Lists collaborators using clinic staff authority rather than global identity access.
   * @param page Bounded pagination.
   * @param request Current operator.
   * @returns Visible staff records.
   */
  @Get("collaborators") @Permissions(PermissionCode.ClinicsStaffList) collaborators(
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.collaboratorsUser.execute(page, request.user);
  }
  /**
   * Reads a collaborator using current clinic scope.
   * @param id Target account.
   * @param request Current operator.
   * @returns Scoped staff record.
   */
  @Get("collaborators/:id") @Permissions(PermissionCode.ClinicsStaffList) collaborator(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.collaboratorUser.execute(id, request.user);
  }
  /**
   * Creates the resource using the supplied input.
   * @param input Validated input for this operation.
   * @param request HTTP request with the authenticated identity.
   * @returns Result of the completed operation.
   */
  @Post() @Permissions(IDENTITY_PERMISSIONS.create.shortcode) create(
    @Body() input: CreateUserDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("create", input, request.user);
  }
  /**
   * Returns the resource identified by its ID.
   * @param id Resource identifier.
   * @param request HTTP request with the authenticated identity.
   * @returns Result of the completed operation.
   */
  @Get(":id") @Permissions(IDENTITY_PERMISSIONS.read.shortcode) read(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.crud("read", id, request.user);
  }
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   * @param request HTTP request with the authenticated identity.
   * @returns Result of the completed operation.
   */
  @Get() @Permissions(IDENTITY_PERMISSIONS.list.shortcode) list(
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("list", page, request.user);
  }
  /**
   * Updates the permitted resource properties.
   * @param id Resource identifier.
   * @param input Validated input for this operation.
   * @param request HTTP request with the authenticated identity.
   * @returns Result of the completed operation.
   */
  @Patch(":id") @Permissions(IDENTITY_PERMISSIONS.update.shortcode) update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateUserDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("update", id, input, request.user);
  }
  /**
   * Deletes the resource identified by its ID.
   * @param id Resource identifier.
   * @param request HTTP request with the authenticated identity.
   * @param _input Validated optional audit reason.
   * @returns Result of the completed operation.
   */
  @Delete(":id") @Permissions(IDENTITY_PERMISSIONS.delete.shortcode) delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest,
    @Body() _input: AuditReasonDto = {}
  ) {
    void _input; // The validated body supplies only the optional audit reason.
    return this.crud("delete", id, request.user);
  }
}
