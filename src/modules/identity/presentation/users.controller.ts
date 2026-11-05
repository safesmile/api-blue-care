import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { IDENTITY_PERMISSIONS } from "../domain/identity.permissions";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from "@nestjs/common";
import { CrudController } from "../../../shared/presentation/crud.controller";
import { UsersUseCase } from "../application/users.usecase";
import { CreateUserDto, UpdateUserDto, PaginationDto } from "./user.dto";
import type { UserView } from "../domain/user";
import { Permissions } from "../../auth/presentation/auth.decorators";
/**
 * Exposes explicit user CRUD routes and their required permissions.
 */
@Controller("users")
export class UsersController extends CrudController<UserView, CreateUserDto, UpdateUserDto, AuthRequest> {
  /**
   * Receives the dependencies required by this component.
   * @param users User repository or user application service.
   */
  constructor(private readonly users: UsersUseCase) {
    super();
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
    return this.users.create(input, request.user);
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
    return this.users.read(id, request.user);
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
    return this.users.list(page, request.user);
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
    return this.users.update(id, input, request.user);
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
    return this.users.delete(id, request.user);
  }
}
