import { Controller, Get, Patch, Param, ParseUUIDPipe, Query, Req, HttpCode } from "@nestjs/common";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { NotificationsUseCase } from "../application/notifications.usecase";
import { NOTIFICATION_PERMISSIONS } from "../domain/notification.permissions";
/** Exposes only the authenticated identity's own inbox. */
@Controller("notifications")
export class NotificationsController {
  /**
   *
   * @param notifications Notification application service.
   */
  constructor(private readonly notifications: NotificationsUseCase) {}
  /**
   *
   * @param request Authenticated HTTP request.
   * @param page Bounded pagination settings.
   * @returns Result of the completed operation.
   */
  @Get()
  @Permissions(NOTIFICATION_PERMISSIONS.inbox.shortcode)
  list(@Req() request: AuthRequest, @Query() page: PaginationDto) {
    return this.notifications.list(request.user.id, page.limit, page.offset);
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
    return this.notifications.markRead(request.user.id, id);
  }
}
