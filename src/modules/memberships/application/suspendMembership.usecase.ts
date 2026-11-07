import type { MembershipView } from "../domain/membership.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { MembershipRepository } from "../domain/membership.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Membership. */
@Injectable()
export class SuspendMembershipUseCase extends EntityUseCase<[id: string, actor: AccessActor], Promise<MembershipView>> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.MembershipsSuspend] };

  /**
   * Recibe las dependencias de la operación.
   * @param memberships Dependencia tipada de memberships.
   */
  constructor(private readonly memberships: MembershipRepository) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, actor: AccessActor) {
    return this.memberships.suspend(id, actor);
  }
}
