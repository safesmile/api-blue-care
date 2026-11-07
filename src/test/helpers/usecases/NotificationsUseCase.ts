import { ConfigService } from "@nestjs/config";
import { NotificationRepository } from "../../../modules/notifications/domain/notification.repository";
import { JobQueue } from "../../../shared/domain/job-queue";
import { EmailSender } from "../../../shared/domain/email-sender";
import { NotifyNotificationUseCase } from "../../../modules/notifications/application/notifyNotification.usecase";
import { CrudNotificationsUseCase } from "../../../modules/notifications/application/crudNotifications.usecase";
import { MarkReadNotificationUseCase } from "../../../modules/notifications/application/markReadNotification.usecase";
import { CancelNotificationUseCase } from "../../../modules/notifications/application/cancelNotification.usecase";
import { DeliverNotificationUseCase } from "../../../modules/notifications/application/deliverNotification.usecase";
import { DrainNotificationUseCase } from "../../../modules/notifications/application/drainNotification.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class NotificationsUseCase {
  private readonly NotifyNotificationUseCase: NotifyNotificationUseCase;
  private readonly CrudNotificationsUseCase: CrudNotificationsUseCase;
  private readonly MarkReadNotificationUseCase: MarkReadNotificationUseCase;
  private readonly CancelNotificationUseCase: CancelNotificationUseCase;
  private readonly DeliverNotificationUseCase: DeliverNotificationUseCase;
  private readonly DrainNotificationUseCase: DrainNotificationUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   * @param jobs Dependencia tipada de jobs.
   * @param mail Dependencia tipada de mail.
   * @param config Dependencia tipada de config.
   */
  constructor(repository: NotificationRepository, jobs: JobQueue, mail: EmailSender, config: ConfigService) {
    this.NotifyNotificationUseCase = new NotifyNotificationUseCase(repository, jobs);
    this.CrudNotificationsUseCase = new CrudNotificationsUseCase(repository);
    this.MarkReadNotificationUseCase = new MarkReadNotificationUseCase(repository);
    this.CancelNotificationUseCase = new CancelNotificationUseCase(repository);
    this.DeliverNotificationUseCase = new DeliverNotificationUseCase(repository, mail, config);
    this.DrainNotificationUseCase = new DrainNotificationUseCase(
      repository,
      new DeliverNotificationUseCase(repository, mail, config)
    );
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  notify(...args: Parameters<NotifyNotificationUseCase["execute"]>): ReturnType<NotifyNotificationUseCase["execute"]> {
    return this.NotifyNotificationUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  list(...args: Parameters<CrudNotificationsUseCase["list"]>): ReturnType<CrudNotificationsUseCase["list"]> {
    return this.CrudNotificationsUseCase.list(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  markRead(
    ...args: Parameters<MarkReadNotificationUseCase["execute"]>
  ): ReturnType<MarkReadNotificationUseCase["execute"]> {
    return this.MarkReadNotificationUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  cancel(...args: Parameters<CancelNotificationUseCase["execute"]>): ReturnType<CancelNotificationUseCase["execute"]> {
    return this.CancelNotificationUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  deliver(
    ...args: Parameters<DeliverNotificationUseCase["execute"]>
  ): ReturnType<DeliverNotificationUseCase["execute"]> {
    return this.DeliverNotificationUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  drain(...args: Parameters<DrainNotificationUseCase["execute"]>): ReturnType<DrainNotificationUseCase["execute"]> {
    return this.DrainNotificationUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: NotifyNotificationUseCase, useValue: { execute: value.notify } },
      { provide: CrudNotificationsUseCase, useValue: value },
      { provide: MarkReadNotificationUseCase, useValue: { execute: value.markRead } },
      { provide: CancelNotificationUseCase, useValue: { execute: value.cancel } },
      { provide: DeliverNotificationUseCase, useValue: { execute: value.deliver } },
      { provide: DrainNotificationUseCase, useValue: { execute: value.drain } }
    ];
  }
  /**
   *
   * @param app Entrada de la operación.
   * @param app.get Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static resolve(app: { get(token: any): any }) {
    return {
      notify: (...args: Parameters<NotifyNotificationUseCase["execute"]>) =>
        app.get(NotifyNotificationUseCase).execute(...args),
      list: (...args: Parameters<CrudNotificationsUseCase["list"]>) => app.get(CrudNotificationsUseCase).list(...args),
      markRead: (...args: Parameters<MarkReadNotificationUseCase["execute"]>) =>
        app.get(MarkReadNotificationUseCase).execute(...args),
      cancel: (...args: Parameters<CancelNotificationUseCase["execute"]>) =>
        app.get(CancelNotificationUseCase).execute(...args),
      deliver: (...args: Parameters<DeliverNotificationUseCase["execute"]>) =>
        app.get(DeliverNotificationUseCase).execute(...args),
      drain: (...args: Parameters<DrainNotificationUseCase["execute"]>) =>
        app.get(DrainNotificationUseCase).execute(...args)
    };
  }
}
