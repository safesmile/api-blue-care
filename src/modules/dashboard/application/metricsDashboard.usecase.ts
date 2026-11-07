import type { DashboardMetrics } from "../domain/dashboard.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { DashboardRepository, type DashboardQuery } from "../domain/dashboard.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Dashboard. */
@Injectable()
export class MetricsDashboardUseCase extends EntityUseCase<
  [query: DashboardQuery, actor: AccessActor],
  Promise<DashboardMetrics>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.DashboardRead] };

  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   */
  constructor(private readonly repository: DashboardRepository) {
    super();
  }
  /**
   *
   * @param query Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(query: DashboardQuery, actor: AccessActor) {
    return this.repository.metrics(query, actor);
  }
}
