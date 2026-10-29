import { IDENTITY_PERMISSIONS } from "../domain/identity.permissions";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CrudController } from "../../../shared/presentation/crud.controller";
import { UsersUseCase } from "../application/users.usecase";
import { CreateUserDto, UpdateUserDto, PaginationDto } from "./user.dto";
import type { UserView } from "../domain/user";
import { Permissions } from "../../auth/presentation/auth.decorators";
/**
 * Exposes explicit user CRUD routes and their required permissions.
 */
@Controller("users")
export class UsersController extends CrudController<UserView, CreateUserDto, UpdateUserDto> {
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
   * @returns Result of the completed operation.
   */
  @Post() @Permissions(IDENTITY_PERMISSIONS.create.shortcode) create(@Body() input: CreateUserDto) {
    return this.users.create(input);
  }
  /**
   * Returns the resource identified by its ID.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  @Get(":id") @Permissions(IDENTITY_PERMISSIONS.read.shortcode) read(@Param("id", ParseUUIDPipe) id: string) {
    return this.users.read(id);
  }
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   * @returns Result of the completed operation.
   */
  @Get() @Permissions(IDENTITY_PERMISSIONS.list.shortcode) list(@Query() page: PaginationDto) {
    return this.users.list(page);
  }
  /**
   * Updates the permitted resource properties.
   * @param id Resource identifier.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  @Patch(":id") @Permissions(IDENTITY_PERMISSIONS.update.shortcode) update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateUserDto
  ) {
    return this.users.update(id, input);
  }
  /**
   * Deletes the resource identified by its ID.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  @Delete(":id") @Permissions(IDENTITY_PERMISSIONS.delete.shortcode) delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.users.delete(id);
  }
}
