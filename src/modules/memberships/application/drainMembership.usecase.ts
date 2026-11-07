import { Injectable } from "@nestjs/common";
import { MembershipBilling } from "../domain/membership-billing";
import { EntityUseCase } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Membership. */
@Injectable()
export class DrainMembershipUseCase extends EntityUseCase<[], Promise<{ payments: number; commands: number }>> {
  /**
   * Recibe las dependencias de la operación.
   * @param billing Dependencia tipada de billing.
   */
  constructor(private readonly billing: MembershipBilling) {
    super();
  }
  /**
   *
   * @returns Resultado de la operación.
   */
  protected perform() {
    return this.billing.drain();
  }
}
