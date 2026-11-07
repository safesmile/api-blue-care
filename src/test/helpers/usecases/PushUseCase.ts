import { ConfigService } from "@nestjs/config";
import { PushRepository, PushSender } from "../../../modules/notifications/domain/push.repository";
import { RegisterPushUseCase } from "../../../modules/notifications/application/registerPush.usecase";
import { CrudPushUseCase } from "../../../modules/notifications/application/crudPush.usecase";
import { RemovePushUseCase } from "../../../modules/notifications/application/removePush.usecase";
import { DrainPushUseCase } from "../../../modules/notifications/application/drainPush.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class PushUseCase {
  private readonly RegisterPushUseCase: RegisterPushUseCase;
  private readonly CrudPushUseCase: CrudPushUseCase;
  private readonly RemovePushUseCase: RemovePushUseCase;
  private readonly DrainPushUseCase: DrainPushUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   * @param sender Dependencia tipada de sender.
   * @param config Dependencia tipada de config.
   */
  constructor(repository: PushRepository, sender: PushSender, config: ConfigService) {
    this.RegisterPushUseCase = new RegisterPushUseCase(repository);
    this.CrudPushUseCase = new CrudPushUseCase(repository);
    this.RemovePushUseCase = new RemovePushUseCase(repository);
    this.DrainPushUseCase = new DrainPushUseCase(repository, sender, config);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  register(...args: Parameters<RegisterPushUseCase["execute"]>): ReturnType<RegisterPushUseCase["execute"]> {
    return this.RegisterPushUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  list(...args: Parameters<CrudPushUseCase["list"]>): ReturnType<CrudPushUseCase["list"]> {
    return this.CrudPushUseCase.list(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  remove(...args: Parameters<RemovePushUseCase["execute"]>): ReturnType<RemovePushUseCase["execute"]> {
    return this.RemovePushUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  drain(...args: Parameters<DrainPushUseCase["execute"]>): ReturnType<DrainPushUseCase["execute"]> {
    return this.DrainPushUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: RegisterPushUseCase, useValue: { execute: value.register } },
      { provide: CrudPushUseCase, useValue: value },
      { provide: RemovePushUseCase, useValue: { execute: value.remove } },
      { provide: DrainPushUseCase, useValue: { execute: value.drain } }
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
      register: (...args: Parameters<RegisterPushUseCase["execute"]>) => app.get(RegisterPushUseCase).execute(...args),
      list: (...args: Parameters<CrudPushUseCase["list"]>) => app.get(CrudPushUseCase).list(...args),
      remove: (...args: Parameters<RemovePushUseCase["execute"]>) => app.get(RemovePushUseCase).execute(...args),
      drain: (...args: Parameters<DrainPushUseCase["execute"]>) => app.get(DrainPushUseCase).execute(...args)
    };
  }
}
