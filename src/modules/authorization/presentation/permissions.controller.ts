import { AUTHORIZATION_PERMISSIONS } from "../domain/authorization.permissions";
import { Controller, Get, Req } from "@nestjs/common";
import { RolesUseCase } from "../application/roles.usecase";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
/** Read-only catalog; permissions are authored by modules, never invented via HTTP. */
@Controller("permissions")
export class PermissionsController {
  /**
   *
   * @param roles Role definitions or assigned role names.
   * @returns Result of the completed operation.
   */
  constructor(private readonly roles: RolesUseCase) {}
  /**
   *
   * @param req HTTP request with the authenticated identity.
   * @returns Result of the completed operation.
   */
  @Get() @Permissions(AUTHORIZATION_PERMISSIONS.catalog.shortcode) list(@Req() req: AuthRequest) {
    return this.roles.catalog(req.user);
  }
}
