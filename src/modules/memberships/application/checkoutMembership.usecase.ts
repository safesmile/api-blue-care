import { Injectable } from "@nestjs/common";
import { MembershipBilling } from "../domain/membership-billing";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
import { CrudMembershipsUseCase } from "./crudMemberships.usecase";

/** Caso de uso específico de Membership. */
@Injectable()
export class CheckoutMembershipUseCase extends EntityUseCase<
  [id: string, actor: AccessActor],
  Promise<{ id: string; url: string }>
> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param billing Dependencia tipada de billing.
   * @param readOperation Dependencia tipada de readOperation.
   */
  constructor(
    private readonly billing: MembershipBilling,
    private readonly readOperation: CrudMembershipsUseCase
  ) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async perform(id: string, actor: AccessActor) {
    await this.readOperation.read(id, actor, true);
    return this.billing.checkout(id);
  }
}
