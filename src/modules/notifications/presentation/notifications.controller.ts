import { CrudEntityController } from "../../../shared/presentation/crud.controller";
import { Controller, Get, Patch, Param, ParseUUIDPipe, Query, Req, HttpCode } from "@nestjs/common";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { CrudNotificationsUseCase } from "../application/crudNotifications.usecase";
import { MarkReadNotificationUseCase } from "../application/markReadNotification.usecase";
import { NOTIFICATION_PERMISSIONS } from "../domain/notification.permissions";
/** Exposes only the authenticated identity's own inbox. */
@Controller("notifications")
export class NotificationsController extends CrudEntityController<CrudNotificationsUseCase> {
  /**
   * Recibe las dependencias de la operación.
   * @param notifications Dependencia tipada de notifications.
   * @param markReadNotification Dependencia tipada de markReadNotification.
   */
  constructor(
    notifications: CrudNotificationsUseCase,
    private readonly markReadNotification: MarkReadNotificationUseCase
  ) {
    super(notifications);
  }
  /**
   *
   * @param request Authenticated HTTP request.
   * @param page Bounded pagination settings.
   * @returns Result of the completed operation.
   */
  @Get()
  @Permissions(NOTIFICATION_PERMISSIONS.inbox.shortcode)
  list(@Req() request: AuthRequest, @Query() page: PaginationDto) {
    return this.crud("list", request.user.id, page.limit, page.offset);
  }
  /**
   *
   * @param request Authenticated HTTP request.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  @Patch(":id/read")
  @HttpCode(204)
  @Permissions(NOTIFICATION_PERMISSIONS.read.shortcode)
  markRead(@Req() request: AuthRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.markReadNotification.execute(request.user.id, id);
  }
}
