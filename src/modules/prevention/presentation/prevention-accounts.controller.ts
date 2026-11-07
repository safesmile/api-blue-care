import { CrudEntityController } from "../../../shared/presentation/crud.controller";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Controller, Get, Param, ParseUUIDPipe, Query, Req } from "@nestjs/common";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { CrudPreventionUseCase } from "../application/crudPrevention.usecase";
import { PreventionQueryDto } from "./prevention.dto";
/** Read-only patient timeline does not require a paid membership. */
@Controller("prevention/me")
export class PreventionAccountsController extends CrudEntityController<CrudPreventionUseCase> {
  /**
   * Recibe las dependencias de la operación.
   * @param prevention Dependencia tipada de prevention.
   */
  constructor(prevention: CrudPreventionUseCase) {
    super(prevention);
  }
  /**
   * Lists bounded records within the current ownership scope.
   * @param query Bounded explicit query filters.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get("events") @Permissions(PermissionCode.PreventionSelf) list(
    @Query() query: PreventionQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("list", query, request.user, true);
  }
  /**
   * Reads the authorized preventive record.
   * @param id Resource identifier.
   * @param request Explicit request value for this operation.
   * @returns The authorized result or completion of the operation.
   */
  @Get("events/:id") @Permissions(PermissionCode.PreventionSelf) read(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.crud("read", id, request.user, true);
  }
}
