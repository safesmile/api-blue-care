import type { Page } from "../../../shared/domain/crud.repository";
import type { PreventionEvent } from "../domain/prevention.repository";
import { PreventionRules } from "./preventionRules.service";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { type AccessActor } from "../../authorization/domain/access-policy";
import {
  PreventionRepository,
  type EventInput,
  type EventQuery,
  type EventUpdate
} from "../domain/prevention.repository";
import { CrudEntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
interface CrudPreventionUseCaseOperations {
  create: (input: EventInput, actor: AccessActor) => Promise<PreventionEvent>;
  read: (id: string, actor: AccessActor, own?: boolean) => Promise<PreventionEvent>;
  list: (query: EventQuery, actor: AccessActor, own?: boolean) => Promise<Page<PreventionEvent>>;
  update: (id: string, input: EventUpdate, actor: AccessActor) => Promise<PreventionEvent>;
}

/** Operaciones CRUD de PreventionEvent. */
@Injectable()
export class CrudPreventionUseCase extends CrudEntityUseCase<CrudPreventionUseCaseOperations> {
  protected readonly asynchronousActions = ["read"];

  protected readonly handlers = {
    create: this.createEntity.bind(this),
    read: this.readEntity.bind(this),
    list: this.listEntity.bind(this),
    update: this.updateEntity.bind(this)
  };
  protected readonly policies: Partial<Record<keyof CrudPreventionUseCaseOperations, OperationPolicy>> = {
    create: { actorIndex: 1, permissions: [PermissionCode.PreventionCreate] },
    read: {
      actorIndex: 1,
      permissions: [PermissionCode.PreventionRead],
      ownPermission: PermissionCode.PreventionSelf,
      ownIndex: 2
    },
    list: {
      actorIndex: 1,
      permissions: [PermissionCode.PreventionRead],
      ownPermission: PermissionCode.PreventionSelf,
      ownIndex: 2
    },
    update: { actorIndex: 2, permissions: [PermissionCode.PreventionUpdate] }
  };

  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly repository: PreventionRepository,
    private readonly rules: PreventionRules
  ) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected createEntity(input: EventInput, actor: AccessActor) {
    this.rules.validate(input);
    return this.repository.create(input, actor);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   * @param own Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async readEntity(id: string, actor: AccessActor, own = false) {
    const event = await this.repository.read(id, actor, own);
    if (!event) throw new NotFoundException("No se encontró el evento preventivo");
    return event;
  }
  /**
   *
   * @param query Entrada de la operación.
   * @param actor Entrada de la operación.
   * @param own Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected listEntity(query: EventQuery, actor: AccessActor, own = false) {
    if (query.from && query.to && new Date(query.from) >= new Date(query.to))
      throw new BadRequestException("El rango de tiempo no es válido");
    return this.repository.list(query, actor, own);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected updateEntity(id: string, input: EventUpdate, actor: AccessActor) {
    this.rules.validate(input);
    return this.repository.update(id, input, actor);
  }
}
