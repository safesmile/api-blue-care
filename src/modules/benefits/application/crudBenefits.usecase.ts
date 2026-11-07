import type { Page } from "../../../shared/domain/crud.repository";
import type { BenefitView } from "../domain/benefit.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable, NotFoundException } from "@nestjs/common";
import { BenefitRepository, type BenefitInput, type BenefitQuery } from "../domain/benefit.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { CrudEntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
interface CrudBenefitsUseCaseOperations {
  create: (input: BenefitInput, actor: AccessActor) => Promise<BenefitView>;
  read: (id: string, actor: AccessActor) => Promise<BenefitView>;
  list: (query: BenefitQuery, actor: AccessActor) => Promise<Page<BenefitView>>;
}

/** Operaciones CRUD de Benefit. */
@Injectable()
export class CrudBenefitsUseCase extends CrudEntityUseCase<CrudBenefitsUseCaseOperations> {
  protected readonly asynchronousActions = ["read"];

  protected readonly handlers = {
    create: this.createEntity.bind(this),
    read: this.readEntity.bind(this),
    list: this.listEntity.bind(this)
  };
  protected readonly policies: Partial<Record<keyof CrudBenefitsUseCaseOperations, OperationPolicy>> = {
    create: { actorIndex: 1, permissions: [PermissionCode.BenefitsCreate] },
    read: { actorIndex: 1, permissions: [PermissionCode.BenefitsRead] },
    list: { actorIndex: 1, permissions: [PermissionCode.BenefitsList] }
  };

  /**
   * Recibe las dependencias de la operación.
   * @param benefits Dependencia tipada de benefits.
   */
  constructor(private readonly benefits: BenefitRepository) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected createEntity(input: BenefitInput, actor: AccessActor) {
    return this.benefits.create(input, actor);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async readEntity(id: string) {
    const benefit = await this.benefits.read(id);
    if (!benefit) throw new NotFoundException("No se encontró el beneficio");
    return benefit;
  }
  /**
   *
   * @param query Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected listEntity(query: BenefitQuery) {
    return this.benefits.list(query);
  }
}
