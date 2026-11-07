import { DrainPushUseCase } from "../application/drainPush.usecase";
import { Body, Controller, Post, HttpCode, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { IsUUID } from "class-validator";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../auth/presentation/auth.decorators";
import { GoogleJobGuard } from "../../../infrastructure/jobs/google-job.guard";
import { DeliverNotificationUseCase } from "../application/deliverNotification.usecase";
import { DrainNotificationUseCase } from "../application/drainNotification.usecase";
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
   * Recibe las dependencias de la operación.
   * @param deliverNotification Dependencia tipada de deliverNotification.
   * @param drainNotification Dependencia tipada de drainNotification.
   * @param drainPush Dependencia tipada de drainPush.
   */
  constructor(
    private readonly deliverNotification: DeliverNotificationUseCase,
    private readonly drainNotification: DrainNotificationUseCase,
    private readonly drainPush: DrainPushUseCase
  ) {}
  /**
   *
   * @param input Validated operation input.
   * @returns Result of the completed operation.
   */
  @Post("deliver")
  @HttpCode(204)
  async deliver(@Body() input: DeliveryJobDto) {
    if (!(await this.deliverNotification.execute(input.id)))
      throw new ServiceUnavailableException("El envío está pendiente de un nuevo intento");
  }
  /**
   *
   * @returns Result of the completed operation.
   */
  @Post("dispatch")
  @HttpCode(200)
  async dispatch() {
    const email = await this.drainNotification.execute();
    const push = await this.drainPush.execute();
    return { ...email, pushSent: push.sent };
  }
}
