import { PushUseCase } from "./application/push.usecase";
import { PushRepository, PushSender } from "./domain/push.repository";
import { SqlPushRepository } from "./infrastructure/sql-push.repository";
import { FcmPushSender } from "./infrastructure/fcm-push-sender";
import { PushController } from "./presentation/push.controller";
import { Module } from "@nestjs/common";
import { EmailModule } from "../../infrastructure/email/email.module";
import { JobsModule } from "../../infrastructure/jobs/jobs.module";
import { NotificationRepository } from "./domain/notification.repository";
import { SqlNotificationRepository } from "./infrastructure/sql-notification.repository";
import { NotificationsUseCase } from "./application/notifications.usecase";
import { NotificationsController } from "./presentation/notifications.controller";
import { NotificationJobsController } from "./presentation/notification-jobs.controller";
/** Persistent notification infrastructure usable by future business modules. */
@Module({
  imports: [EmailModule, JobsModule],
  controllers: [NotificationsController, NotificationJobsController, PushController],
  providers: [
    PushUseCase,
    { provide: PushRepository, useClass: SqlPushRepository },
    { provide: PushSender, useClass: FcmPushSender },
    NotificationsUseCase,
    { provide: NotificationRepository, useClass: SqlNotificationRepository }
  ],
  exports: [NotificationsUseCase, PushUseCase]
})
export class NotificationsModule {}
