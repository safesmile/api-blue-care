import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Patch, Query, Req } from "@nestjs/common";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { PreventionUseCase } from "../application/prevention.usecase";
import {
  CompletePreventiveEventDto,
  CreatePreventiveEventDto,
  EventVersionDto,
  PreventionQueryDto,
  PreventionTypeDto,
  UpdatePreventiveEventDto
} from "./prevention.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
/** Administrative tracking is separate from appointments and benefit consumption. */
@Controller("prevention")
export class PreventionController {
  /**
   * Receives the explicit persistence and transport dependencies.
   * @param prevention Explicit prevention value for this operation.
   */
  constructor(private readonly prevention: PreventionUseCase) {}
  /**
   * Lists configured preventive event types.
   * @param page Bounded pagination values.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get("types") @Permissions("prevention:read") types(@Query() page: PaginationDto, @Req() request: AuthRequest) {
    return this.prevention.types(page, request.user);
  }
  /**
   * Coordinates the authorized operation.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Post("types") @Permissions("prevention:configure") createType(
    @Body() input: PreventionTypeDto,
    @Req() request: AuthRequest
  ) {
    return this.prevention.saveType(null, input, request.user);
  }
  /**
   * Coordinates the authorized operation.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Put("types/:id") @Permissions("prevention:configure") updateType(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PreventionTypeDto,
    @Req() request: AuthRequest
  ) {
    return this.prevention.saveType(id, input, request.user);
  }
  /**
   * Lists bounded records within the current ownership scope.
   * @param query Bounded explicit query filters.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get("events") @Permissions("prevention:read") list(@Query() query: PreventionQueryDto, @Req() request: AuthRequest) {
    return this.prevention.list(query, request.user);
  }
  /**
   * Reads the authorized preventive record.
   * @param id Resource identifier.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get("events/:id") @Permissions("prevention:read") read(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.prevention.read(id, request.user);
  }
  /**
   * Creates a preventive event without consuming a benefit.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Post("events") @Permissions("prevention:create") create(
    @Body() input: CreatePreventiveEventDto,
    @Req() request: AuthRequest
  ) {
    return this.prevention.create(input, request.user);
  }
  /**
   * Reschedules an open event using its expected version.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Patch("events/:id") @Permissions("prevention:update") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePreventiveEventDto,
    @Req() request: AuthRequest
  ) {
    return this.prevention.update(id, input, request.user);
  }
  /**
   * Records completion and calculates the next patient-specific event.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Post("events/:id/complete") @Permissions("prevention:complete") complete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: CompletePreventiveEventDto,
    @Req() request: AuthRequest
  ) {
    return this.prevention.complete(id, input.expectedVersion, input.occurredAt, request.user);
  }
  /**
   * Closes the event and invalidates pending reminders.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Post("events/:id/cancel") @Permissions("prevention:cancel") cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: EventVersionDto,
    @Req() request: AuthRequest
  ) {
    return this.prevention.cancel(id, input.expectedVersion, request.user);
  }
}
