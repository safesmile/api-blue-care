import { CrudEntityController } from "../../../shared/presentation/crud.controller";
import { Controller, Get, Param, ParseUUIDPipe, Query, Req } from "@nestjs/common";
import { CrudAuditUseCase } from "../application/crudAudit.usecase";
import { AuditQueryDto } from "./audit.dto";
import { AUDIT_PERMISSIONS } from "../domain/audit.permissions";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
/** Privileged, read-only audit API. */
@Controller("audit")
export class AuditController extends CrudEntityController<CrudAuditUseCase> {
  /**
   * Recibe las dependencias de la operación.
   * @param audit Dependencia tipada de audit.
   */
  constructor(audit: CrudAuditUseCase) {
    super(audit);
  }
  /**
   *
   * @param query Validated audit filters and bounded pagination.
   * @param request HTTP request carrying the verified identity.
   * @returns Result of the completed operation.
   */
  @Get() @Permissions(AUDIT_PERMISSIONS.list.shortcode) list(
    @Query() query: AuditQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("list", query, request.user);
  }
  /**
   *
   * @param id Resource identifier.
   * @param request HTTP request carrying the verified identity.
   * @returns Result of the completed operation.
   */
  @Get(":id") @Permissions(AUDIT_PERMISSIONS.read.shortcode) read(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.crud("read", id, request.user);
  }
}
