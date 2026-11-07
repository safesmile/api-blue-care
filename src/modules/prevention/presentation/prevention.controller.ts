import { CrudEntityController } from "../../../shared/presentation/crud.controller";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Patch, Query, Req } from "@nestjs/common";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { TypesPreventionEventUseCase } from "../application/typesPreventionEvent.usecase";
import { SaveTypePreventionEventUseCase } from "../application/saveTypePreventionEvent.usecase";
import { CrudPreventionUseCase } from "../application/crudPrevention.usecase";
import { CompletePreventionEventUseCase } from "../application/completePreventionEvent.usecase";
import { CancelPreventionEventUseCase } from "../application/cancelPreventionEvent.usecase";
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
export class PreventionController extends CrudEntityController<CrudPreventionUseCase> {
  /**
   * Recibe las dependencias de la operación.
   * @param typesPreventionEvent Dependencia tipada de typesPreventionEvent.
   * @param saveTypePreventionEvent Dependencia tipada de saveTypePreventionEvent.
   * @param prevention Dependencia tipada de prevention.
   * @param completePreventionEvent Dependencia tipada de completePreventionEvent.
   * @param cancelPreventionEvent Dependencia tipada de cancelPreventionEvent.
   */
  constructor(
    private readonly typesPreventionEvent: TypesPreventionEventUseCase,
    private readonly saveTypePreventionEvent: SaveTypePreventionEventUseCase,
    prevention: CrudPreventionUseCase,
    private readonly completePreventionEvent: CompletePreventionEventUseCase,
    private readonly cancelPreventionEvent: CancelPreventionEventUseCase
  ) {
    super(prevention);
  }
  /**
   * Lists configured preventive event types.
   * @param page Bounded pagination values.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get("types") @Permissions(PermissionCode.PreventionRead) types(
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.typesPreventionEvent.execute(page, request.user);
  }
  /**
   * Coordinates the authorized operation.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Post("types") @Permissions(PermissionCode.PreventionConfigure) createType(
    @Body() input: PreventionTypeDto,
    @Req() request: AuthRequest
  ) {
    return this.saveTypePreventionEvent.execute(null, input, request.user);
  }
  /**
   * Coordinates the authorized operation.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Put("types/:id") @Permissions(PermissionCode.PreventionConfigure) updateType(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PreventionTypeDto,
    @Req() request: AuthRequest
  ) {
    return this.saveTypePreventionEvent.execute(id, input, request.user);
  }
  /**
   * Lists bounded records within the current ownership scope.
   * @param query Bounded explicit query filters.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get("events") @Permissions(PermissionCode.PreventionRead) list(
    @Query() query: PreventionQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("list", query, request.user);
  }
  /**
   * Reads the authorized preventive record.
   * @param id Resource identifier.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get("events/:id") @Permissions(PermissionCode.PreventionRead) read(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.crud("read", id, request.user);
  }
  /**
   * Creates a preventive event without consuming a benefit.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Post("events") @Permissions(PermissionCode.PreventionCreate) create(
    @Body() input: CreatePreventiveEventDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("create", input, request.user);
  }
  /**
   * Reschedules an open event using its expected version.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Patch("events/:id") @Permissions(PermissionCode.PreventionUpdate) update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePreventiveEventDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("update", id, input, request.user);
  }
  /**
   * Records completion and calculates the next patient-specific event.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Post("events/:id/complete") @Permissions(PermissionCode.PreventionComplete) complete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: CompletePreventiveEventDto,
    @Req() request: AuthRequest
  ) {
    return this.completePreventionEvent.execute(id, input.expectedVersion, input.occurredAt, request.user);
  }
  /**
   * Closes the event and invalidates pending reminders.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Post("events/:id/cancel") @Permissions(PermissionCode.PreventionCancel) cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: EventVersionDto,
    @Req() request: AuthRequest
  ) {
    return this.cancelPreventionEvent.execute(id, input.expectedVersion, request.user);
  }
}
