import { DashboardRepository } from "../../../modules/dashboard/domain/dashboard.repository";
import { UpcomingDashboardUseCase } from "../../../modules/dashboard/application/upcomingDashboard.usecase";
import { MetricsDashboardUseCase } from "../../../modules/dashboard/application/metricsDashboard.usecase";
import { ExpiringDashboardUseCase } from "../../../modules/dashboard/application/expiringDashboard.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class DashboardUseCase {
  private readonly UpcomingDashboardUseCase: UpcomingDashboardUseCase;
  private readonly MetricsDashboardUseCase: MetricsDashboardUseCase;
  private readonly ExpiringDashboardUseCase: ExpiringDashboardUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   */
  constructor(repository: DashboardRepository) {
    this.UpcomingDashboardUseCase = new UpcomingDashboardUseCase(repository);
    this.MetricsDashboardUseCase = new MetricsDashboardUseCase(repository);
    this.ExpiringDashboardUseCase = new ExpiringDashboardUseCase(repository);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  upcoming(...args: Parameters<UpcomingDashboardUseCase["execute"]>): ReturnType<UpcomingDashboardUseCase["execute"]> {
    return this.UpcomingDashboardUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  metrics(...args: Parameters<MetricsDashboardUseCase["execute"]>): ReturnType<MetricsDashboardUseCase["execute"]> {
    return this.MetricsDashboardUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  expiring(...args: Parameters<ExpiringDashboardUseCase["execute"]>): ReturnType<ExpiringDashboardUseCase["execute"]> {
    return this.ExpiringDashboardUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: UpcomingDashboardUseCase, useValue: { execute: value.upcoming } },
      { provide: MetricsDashboardUseCase, useValue: { execute: value.metrics } },
      { provide: ExpiringDashboardUseCase, useValue: { execute: value.expiring } }
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
      upcoming: (...args: Parameters<UpcomingDashboardUseCase["execute"]>) =>
        app.get(UpcomingDashboardUseCase).execute(...args),
      metrics: (...args: Parameters<MetricsDashboardUseCase["execute"]>) =>
        app.get(MetricsDashboardUseCase).execute(...args),
      expiring: (...args: Parameters<ExpiringDashboardUseCase["execute"]>) =>
        app.get(ExpiringDashboardUseCase).execute(...args)
    };
  }
}
