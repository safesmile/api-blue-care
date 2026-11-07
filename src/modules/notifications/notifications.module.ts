import { RegisterPushUseCase } from "./application/registerPush.usecase";
import { CrudPushUseCase } from "./application/crudPush.usecase";
import { RemovePushUseCase } from "./application/removePush.usecase";
import { DrainPushUseCase } from "./application/drainPush.usecase";
import { PushRepository, PushSender } from "./domain/push.repository";
import { SqlPushRepository } from "./infrastructure/sql-push.repository";
import { FcmPushSender } from "./infrastructure/fcm-push-sender";
import { PushController } from "./presentation/push.controller";
import { Module } from "@nestjs/common";
import { EmailModule } from "../../infrastructure/email/email.module";
import { JobsModule } from "../../infrastructure/jobs/jobs.module";
import { NotificationRepository } from "./domain/notification.repository";
import { SqlNotificationRepository } from "./infrastructure/sql-notification.repository";
import { NotifyNotificationUseCase } from "./application/notifyNotification.usecase";
import { CrudNotificationsUseCase } from "./application/crudNotifications.usecase";
import { MarkReadNotificationUseCase } from "./application/markReadNotification.usecase";
import { CancelNotificationUseCase } from "./application/cancelNotification.usecase";
import { DeliverNotificationUseCase } from "./application/deliverNotification.usecase";
import { DrainNotificationUseCase } from "./application/drainNotification.usecase";
import { NotificationsController } from "./presentation/notifications.controller";
import { NotificationJobsController } from "./presentation/notification-jobs.controller";
/** Persistent notification infrastructure usable by future business modules. */
@Module({
  imports: [EmailModule, JobsModule],
  controllers: [NotificationsController, NotificationJobsController, PushController],
  providers: [
    RegisterPushUseCase,
    CrudPushUseCase,
    RemovePushUseCase,
    DrainPushUseCase,
    { provide: PushRepository, useClass: SqlPushRepository },
    { provide: PushSender, useClass: FcmPushSender },
    NotifyNotificationUseCase,
    CrudNotificationsUseCase,
    MarkReadNotificationUseCase,
    CancelNotificationUseCase,
    DeliverNotificationUseCase,
    DrainNotificationUseCase,
    { provide: NotificationRepository, useClass: SqlNotificationRepository }
  ],
  exports: [
    NotifyNotificationUseCase,
    CrudNotificationsUseCase,
    MarkReadNotificationUseCase,
    CancelNotificationUseCase,
    DeliverNotificationUseCase,
    DrainNotificationUseCase,
    RegisterPushUseCase,
    CrudPushUseCase,
    RemovePushUseCase,
    DrainPushUseCase
  ]
})
export class NotificationsModule {}
