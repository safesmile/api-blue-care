import { PreventionRules } from "../../../modules/prevention/application/preventionRules.service";
import { PreventionRepository } from "../../../modules/prevention/domain/prevention.repository";
import { TypesPreventionEventUseCase } from "../../../modules/prevention/application/typesPreventionEvent.usecase";
import { SaveTypePreventionEventUseCase } from "../../../modules/prevention/application/saveTypePreventionEvent.usecase";
import { CrudPreventionUseCase } from "../../../modules/prevention/application/crudPrevention.usecase";
import { CompletePreventionEventUseCase } from "../../../modules/prevention/application/completePreventionEvent.usecase";
import { CancelPreventionEventUseCase } from "../../../modules/prevention/application/cancelPreventionEvent.usecase";
import { DrainPreventionEventUseCase } from "../../../modules/prevention/application/drainPreventionEvent.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class PreventionUseCase {
  private readonly TypesPreventionEventUseCase: TypesPreventionEventUseCase;
  private readonly SaveTypePreventionEventUseCase: SaveTypePreventionEventUseCase;
  private readonly CrudPreventionUseCase: CrudPreventionUseCase;
  private readonly CompletePreventionEventUseCase: CompletePreventionEventUseCase;
  private readonly CancelPreventionEventUseCase: CancelPreventionEventUseCase;
  private readonly DrainPreventionEventUseCase: DrainPreventionEventUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   */
  constructor(repository: PreventionRepository) {
    this.TypesPreventionEventUseCase = new TypesPreventionEventUseCase(repository);
    this.SaveTypePreventionEventUseCase = new SaveTypePreventionEventUseCase(repository);
    this.CrudPreventionUseCase = new CrudPreventionUseCase(repository, new PreventionRules());
    this.CompletePreventionEventUseCase = new CompletePreventionEventUseCase(repository);
    this.CancelPreventionEventUseCase = new CancelPreventionEventUseCase(repository);
    this.DrainPreventionEventUseCase = new DrainPreventionEventUseCase(repository);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  types(
    ...args: Parameters<TypesPreventionEventUseCase["execute"]>
  ): ReturnType<TypesPreventionEventUseCase["execute"]> {
    return this.TypesPreventionEventUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  saveType(
    ...args: Parameters<SaveTypePreventionEventUseCase["execute"]>
  ): ReturnType<SaveTypePreventionEventUseCase["execute"]> {
    return this.SaveTypePreventionEventUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  create(...args: Parameters<CrudPreventionUseCase["create"]>): ReturnType<CrudPreventionUseCase["create"]> {
    return this.CrudPreventionUseCase.create(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  read(...args: Parameters<CrudPreventionUseCase["read"]>): ReturnType<CrudPreventionUseCase["read"]> {
    return this.CrudPreventionUseCase.read(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  list(...args: Parameters<CrudPreventionUseCase["list"]>): ReturnType<CrudPreventionUseCase["list"]> {
    return this.CrudPreventionUseCase.list(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  update(...args: Parameters<CrudPreventionUseCase["update"]>): ReturnType<CrudPreventionUseCase["update"]> {
    return this.CrudPreventionUseCase.update(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  complete(
    ...args: Parameters<CompletePreventionEventUseCase["execute"]>
  ): ReturnType<CompletePreventionEventUseCase["execute"]> {
    return this.CompletePreventionEventUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  cancel(
    ...args: Parameters<CancelPreventionEventUseCase["execute"]>
  ): ReturnType<CancelPreventionEventUseCase["execute"]> {
    return this.CancelPreventionEventUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  drain(
    ...args: Parameters<DrainPreventionEventUseCase["execute"]>
  ): ReturnType<DrainPreventionEventUseCase["execute"]> {
    return this.DrainPreventionEventUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: TypesPreventionEventUseCase, useValue: { execute: value.types } },
      { provide: SaveTypePreventionEventUseCase, useValue: { execute: value.saveType } },
      { provide: CrudPreventionUseCase, useValue: value },
      { provide: CompletePreventionEventUseCase, useValue: { execute: value.complete } },
      { provide: CancelPreventionEventUseCase, useValue: { execute: value.cancel } },
      { provide: DrainPreventionEventUseCase, useValue: { execute: value.drain } }
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
      types: (...args: Parameters<TypesPreventionEventUseCase["execute"]>) =>
        app.get(TypesPreventionEventUseCase).execute(...args),
      saveType: (...args: Parameters<SaveTypePreventionEventUseCase["execute"]>) =>
        app.get(SaveTypePreventionEventUseCase).execute(...args),
      create: (...args: Parameters<CrudPreventionUseCase["create"]>) => app.get(CrudPreventionUseCase).create(...args),
      read: (...args: Parameters<CrudPreventionUseCase["read"]>) => app.get(CrudPreventionUseCase).read(...args),
      list: (...args: Parameters<CrudPreventionUseCase["list"]>) => app.get(CrudPreventionUseCase).list(...args),
      update: (...args: Parameters<CrudPreventionUseCase["update"]>) => app.get(CrudPreventionUseCase).update(...args),
      complete: (...args: Parameters<CompletePreventionEventUseCase["execute"]>) =>
        app.get(CompletePreventionEventUseCase).execute(...args),
      cancel: (...args: Parameters<CancelPreventionEventUseCase["execute"]>) =>
        app.get(CancelPreventionEventUseCase).execute(...args),
      drain: (...args: Parameters<DrainPreventionEventUseCase["execute"]>) =>
        app.get(DrainPreventionEventUseCase).execute(...args)
    };
  }
}
