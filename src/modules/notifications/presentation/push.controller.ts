import { CrudEntityController } from "../../../shared/presentation/crud.controller";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { IsIn, IsString, Length, Matches } from "class-validator";
import { RegisterPushUseCase } from "../application/registerPush.usecase";
import { CrudPushUseCase } from "../application/crudPush.usecase";
import { RemovePushUseCase } from "../application/removePush.usecase";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { PaginationDto } from "../../identity/presentation/user.dto";
/**
 * Defines the validated prevention, dashboard or notification contract.
 */
export class PushDeviceDto {
  @IsString() @Length(20, 4096) @Matches(/^\S+$/) token!: string;
  @IsIn(["web", "android", "ios"]) platform!: "web" | "android" | "ios";
}
/** Authenticated device ownership is always taken from the session. */
@Controller("notifications/devices")
export class PushController extends CrudEntityController<CrudPushUseCase> {
  /**
   * Recibe las dependencias de la operación.
   * @param registerPush Dependencia tipada de registerPush.
   * @param push Dependencia tipada de push.
   * @param removePush Dependencia tipada de removePush.
   */
  constructor(
    private readonly registerPush: RegisterPushUseCase,
    push: CrudPushUseCase,
    private readonly removePush: RemovePushUseCase
  ) {
    super(push);
  }
  /**
   * Registers the authenticated owner device without returning its token.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Post() @Permissions(PermissionCode.NotificationsDevices) register(
    @Body() input: PushDeviceDto,
    @Req() request: AuthRequest
  ) {
    return this.registerPush.execute(input, request.user);
  }
  /**
   * Lists bounded records within the current ownership scope.
   * @param page Bounded pagination values.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get() @Permissions(PermissionCode.NotificationsDevices) list(
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("list", page, request.user);
  }
  /**
   * Disables only a device belonging to the authenticated owner.
   * @param id Resource identifier.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Delete(":id") @HttpCode(204) @Permissions(PermissionCode.NotificationsDevices) remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.removePush.execute(id, request.user);
  }
}
