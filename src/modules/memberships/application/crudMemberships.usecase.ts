import type { Page } from "../../../shared/domain/crud.repository";
import type { MembershipView } from "../domain/membership.repository";
import { MembershipsRules } from "./membershipsRules.service";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable, NotFoundException } from "@nestjs/common";
import { MembershipRepository, type MembershipInput, type MembershipQuery } from "../domain/membership.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { CrudEntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
interface CrudMembershipsUseCaseOperations {
  create: (input: MembershipInput, actor: AccessActor) => Promise<MembershipView>;
  read: (id: string, actor: AccessActor, own?: boolean) => Promise<MembershipView>;
  list: (query: MembershipQuery, actor: AccessActor, own?: boolean) => Promise<Page<MembershipView>>;
}

/** Operaciones CRUD de Membership. */
@Injectable()
export class CrudMembershipsUseCase extends CrudEntityUseCase<CrudMembershipsUseCaseOperations> {
  protected readonly asynchronousActions = ["read"];

  protected readonly handlers = {
    create: this.createEntity.bind(this),
    read: this.readEntity.bind(this),
    list: this.listEntity.bind(this)
  };
  protected readonly policies: Partial<Record<keyof CrudMembershipsUseCaseOperations, OperationPolicy>> = {
    create: { actorIndex: 1, permissions: [PermissionCode.MembershipsCreate] },
    read: {
      actorIndex: 1,
      permissions: [PermissionCode.MembershipsRead],
      ownPermission: PermissionCode.MembershipsSelf,
      ownIndex: 2
    },
    list: {
      actorIndex: 1,
      permissions: [PermissionCode.MembershipsList],
      ownPermission: PermissionCode.MembershipsSelf,
      ownIndex: 2
    }
  };

  /**
   * Recibe las dependencias de la operación.
   * @param memberships Dependencia tipada de memberships.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly rules: MembershipsRules
  ) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected createEntity(input: MembershipInput, actor: AccessActor) {
    this.rules.validate(input.cadence);
    return this.memberships.create(input, actor, false);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   * @param own Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async readEntity(id: string, actor: AccessActor, own = false) {
    const membership = await this.memberships.read(id, actor, own);
    if (!membership) throw new NotFoundException("No se encontró la membresía");
    return membership;
  }
  /**
   *
   * @param query Entrada de la operación.
   * @param actor Entrada de la operación.
   * @param own Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected listEntity(query: MembershipQuery, actor: AccessActor, own = false) {
    return this.memberships.list(query, actor, own);
  }
}
