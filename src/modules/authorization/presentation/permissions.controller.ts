import { AUTHORIZATION_PERMISSIONS } from "../domain/authorization.permissions";
import { Controller, Get, Req } from "@nestjs/common";
import { CatalogRoleUseCase } from "../application/catalogRole.usecase";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
/** Read-only catalog; permissions are authored by modules, never invented via HTTP. */
@Controller("permissions")
export class PermissionsController {
  /**
   * Recibe las dependencias de la operación.
   * @param catalogRole Dependencia tipada de catalogRole.
   */
  constructor(private readonly catalogRole: CatalogRoleUseCase) {}
  /**
   *
   * @param req HTTP request with the authenticated identity.
   * @returns Result of the completed operation.
   */
  @Get() @Permissions(AUTHORIZATION_PERMISSIONS.catalog.shortcode) list(@Req() req: AuthRequest) {
    return this.catalogRole.execute(req.user);
  }
}
