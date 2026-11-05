import { PushUseCase } from "../application/push.usecase";
import { Body, Controller, Post, HttpCode, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { IsUUID } from "class-validator";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../auth/presentation/auth.decorators";
import { GoogleJobGuard } from "../../../infrastructure/jobs/google-job.guard";
import { NotificationsUseCase } from "../application/notifications.usecase";
/**
 *
 */
export class DeliveryJobDto {
  @IsUUID() id!: string;
}
/** Internal endpoints require Google OIDC even in development; job headers alone never grant access. */
@Controller("internal/jobs/notifications")
@Public()
@UseGuards(GoogleJobGuard)
@SkipThrottle()
export class NotificationJobsController {
  /**
   *
   * @param notifications Notification application service.
   * @param push Durable push delivery application service.
   */
  constructor(
    private readonly notifications: NotificationsUseCase,
    private readonly push: PushUseCase
  ) {}
  /**
   *
   * @param input Validated operation input.
   * @returns Result of the completed operation.
   */
  @Post("deliver")
  @HttpCode(204)
  async deliver(@Body() input: DeliveryJobDto) {
    if (!(await this.notifications.deliver(input.id))) throw new ServiceUnavailableException("Delivery awaiting retry");
  }
  /**
   *
   * @returns Result of the completed operation.
   */
  @Post("dispatch")
  @HttpCode(200)
  async dispatch() {
    const email = await this.notifications.drain();
    const push = await this.push.drain();
    return { ...email, pushSent: push.sent };
  }
}
