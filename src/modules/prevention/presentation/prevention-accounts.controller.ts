import { Controller, Get, Param, ParseUUIDPipe, Query, Req } from "@nestjs/common";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { PreventionUseCase } from "../application/prevention.usecase";
import { PreventionQueryDto } from "./prevention.dto";
/** Read-only patient timeline does not require a paid membership. */
@Controller("prevention/me")
export class PreventionAccountsController {
  /**
   * Receives the explicit persistence and transport dependencies.
   * @param prevention Explicit prevention value for this operation.
   */
  constructor(private readonly prevention: PreventionUseCase) {}
  /**
   * Lists bounded records within the current ownership scope.
   * @param query Bounded explicit query filters.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get("events") @Permissions("prevention:self") list(@Query() query: PreventionQueryDto, @Req() request: AuthRequest) {
    return this.prevention.list(query, request.user, true);
  }
  /**
   * Reads the authorized preventive record.
   * @param id Resource identifier.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get("events/:id") @Permissions("prevention:self") read(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.prevention.read(id, request.user, true);
  }
}
