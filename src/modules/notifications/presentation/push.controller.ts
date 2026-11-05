import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { IsIn, IsString, Length, Matches } from "class-validator";
import { PushUseCase } from "../application/push.usecase";
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
export class PushController {
  /**
   * Receives the explicit persistence and transport dependencies.
   * @param push Explicit push value for this operation.
   */
  constructor(private readonly push: PushUseCase) {}
  /**
   * Registers the authenticated owner device without returning its token.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Post() @Permissions("notifications:devices") register(@Body() input: PushDeviceDto, @Req() request: AuthRequest) {
    return this.push.register(input, request.user);
  }
  /**
   * Lists bounded records within the current ownership scope.
   * @param page Bounded pagination values.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get() @Permissions("notifications:devices") list(@Query() page: PaginationDto, @Req() request: AuthRequest) {
    return this.push.list(page, request.user);
  }
  /**
   * Disables only a device belonging to the authenticated owner.
   * @param id Resource identifier.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Delete(":id") @HttpCode(204) @Permissions("notifications:devices") remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.push.remove(id, request.user);
  }
}
