import { PlanRepository } from "../../../modules/plans/domain/plan.repository";
import { CrudPlansUseCase } from "../../../modules/plans/application/crudPlans.usecase";
import { CatalogPlanUseCase } from "../../../modules/plans/application/catalogPlan.usecase";
import { VersionPlanUseCase } from "../../../modules/plans/application/versionPlan.usecase";
import { VersionsPlanUseCase } from "../../../modules/plans/application/versionsPlan.usecase";
import { PublishPlanUseCase } from "../../../modules/plans/application/publishPlan.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class PlansUseCase {
  private readonly CrudPlansUseCase: CrudPlansUseCase;
  private readonly CatalogPlanUseCase: CatalogPlanUseCase;
  private readonly VersionPlanUseCase: VersionPlanUseCase;
  private readonly VersionsPlanUseCase: VersionsPlanUseCase;
  private readonly PublishPlanUseCase: PublishPlanUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param plans Dependencia tipada de plans.
   */
  constructor(plans: PlanRepository) {
    this.CrudPlansUseCase = new CrudPlansUseCase(plans);
    this.CatalogPlanUseCase = new CatalogPlanUseCase(plans);
    this.VersionPlanUseCase = new VersionPlanUseCase(plans);
    this.VersionsPlanUseCase = new VersionsPlanUseCase(plans);
    this.PublishPlanUseCase = new PublishPlanUseCase(plans);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  create(...args: Parameters<CrudPlansUseCase["create"]>): ReturnType<CrudPlansUseCase["create"]> {
    return this.CrudPlansUseCase.create(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  read(...args: Parameters<CrudPlansUseCase["read"]>): ReturnType<CrudPlansUseCase["read"]> {
    return this.CrudPlansUseCase.read(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  list(...args: Parameters<CrudPlansUseCase["list"]>): ReturnType<CrudPlansUseCase["list"]> {
    return this.CrudPlansUseCase.list(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  catalog(...args: Parameters<CatalogPlanUseCase["execute"]>): ReturnType<CatalogPlanUseCase["execute"]> {
    return this.CatalogPlanUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  version(...args: Parameters<VersionPlanUseCase["execute"]>): ReturnType<VersionPlanUseCase["execute"]> {
    return this.VersionPlanUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  versions(...args: Parameters<VersionsPlanUseCase["execute"]>): ReturnType<VersionsPlanUseCase["execute"]> {
    return this.VersionsPlanUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  publish(...args: Parameters<PublishPlanUseCase["execute"]>): ReturnType<PublishPlanUseCase["execute"]> {
    return this.PublishPlanUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  update(...args: Parameters<CrudPlansUseCase["update"]>): ReturnType<CrudPlansUseCase["update"]> {
    return this.CrudPlansUseCase.update(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: CrudPlansUseCase, useValue: value },
      { provide: CatalogPlanUseCase, useValue: { execute: value.catalog } },
      { provide: VersionPlanUseCase, useValue: { execute: value.version } },
      { provide: VersionsPlanUseCase, useValue: { execute: value.versions } },
      { provide: PublishPlanUseCase, useValue: { execute: value.publish } }
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
      create: (...args: Parameters<CrudPlansUseCase["create"]>) => app.get(CrudPlansUseCase).create(...args),
      read: (...args: Parameters<CrudPlansUseCase["read"]>) => app.get(CrudPlansUseCase).read(...args),
      list: (...args: Parameters<CrudPlansUseCase["list"]>) => app.get(CrudPlansUseCase).list(...args),
      catalog: (...args: Parameters<CatalogPlanUseCase["execute"]>) => app.get(CatalogPlanUseCase).execute(...args),
      version: (...args: Parameters<VersionPlanUseCase["execute"]>) => app.get(VersionPlanUseCase).execute(...args),
      versions: (...args: Parameters<VersionsPlanUseCase["execute"]>) => app.get(VersionsPlanUseCase).execute(...args),
      publish: (...args: Parameters<PublishPlanUseCase["execute"]>) => app.get(PublishPlanUseCase).execute(...args),
      update: (...args: Parameters<CrudPlansUseCase["update"]>) => app.get(CrudPlansUseCase).update(...args)
    };
  }
}
