import type { MembershipPeriod } from "../domain/membership.repository";
import type { Page } from "../../../shared/domain/crud.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { MembershipRepository } from "../domain/membership.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Membership. */
@Injectable()
export class PeriodsMembershipUseCase extends EntityUseCase<
  [id: string, page: Pagination, actor: AccessActor, own?: boolean],
  Promise<Page<MembershipPeriod>>
> {
  protected readonly policy: OperationPolicy = {
    actorIndex: 2,
    permissions: [PermissionCode.MembershipsRead],
    ownPermission: PermissionCode.MembershipsSelf,
    ownIndex: 3
  };

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
   * @param page Entrada de la operación.
   * @param actor Entrada de la operación.
   * @param own Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, page: Pagination, actor: AccessActor, own = false) {
    return this.memberships.periods(id, page, actor, own);
  }
}
