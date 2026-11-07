import type { Page } from "../../../shared/domain/crud.repository";
import type { PlanView } from "../domain/plan.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PlanRepository } from "../domain/plan.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { CrudEntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
interface CrudPlansUseCaseOperations {
  create: (code: string, actor: AccessActor) => Promise<PlanView>;
  read: (id: string, actor: AccessActor) => Promise<PlanView>;
  list: (page: Pagination, actor: AccessActor) => Promise<Page<PlanView>>;
  update: (id: string, enabled: boolean, actor: AccessActor) => Promise<PlanView>;
}

/** Operaciones CRUD de Plan. */
@Injectable()
export class CrudPlansUseCase extends CrudEntityUseCase<CrudPlansUseCaseOperations> {
  protected readonly asynchronousActions = ["read"];

  protected readonly handlers = {
    create: this.createEntity.bind(this),
    read: this.readEntity.bind(this),
    list: this.listEntity.bind(this),
    update: this.updateEntity.bind(this)
  };
  protected readonly policies: Partial<Record<keyof CrudPlansUseCaseOperations, OperationPolicy>> = {
    create: { actorIndex: 1, permissions: [PermissionCode.PlansCreate] },
    read: { actorIndex: 1, permissions: [PermissionCode.PlansRead] },
    list: { actorIndex: 1, permissions: [PermissionCode.PlansList] },
    update: { actorIndex: 2, permissions: [PermissionCode.PlansUpdate] }
  };

  /**
   * Recibe las dependencias de la operación.
   * @param plans Dependencia tipada de plans.
   */
  constructor(private readonly plans: PlanRepository) {
    super();
  }
  /**
   *
   * @param code Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected createEntity(code: string, actor: AccessActor) {
    return this.plans.create(code, actor);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async readEntity(id: string) {
    const plan = await this.plans.read(id);
    if (!plan) throw new NotFoundException("No se encontró el plan");
    return plan;
  }
  /**
   *
   * @param page Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected listEntity(page: Pagination) {
    return this.plans.list(page, false);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param enabled Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected updateEntity(id: string, enabled: boolean, actor: AccessActor) {
    return this.plans.update(id, enabled, actor);
  }
}
