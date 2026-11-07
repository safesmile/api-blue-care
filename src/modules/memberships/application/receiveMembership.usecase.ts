import { Injectable } from "@nestjs/common";
import { MembershipBilling, MembershipGateway } from "../domain/membership-billing";
import { EntityUseCase } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Membership. */
@Injectable()
export class ReceiveMembershipUseCase extends EntityUseCase<
  [body: Buffer, headers: Record<string, unknown>],
  Promise<void>
> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param billing Dependencia tipada de billing.
   * @param gateway Dependencia tipada de gateway.
   */
  constructor(
    private readonly billing: MembershipBilling,
    private readonly gateway: MembershipGateway
  ) {
    super();
  }
  /**
   *
   * @param body Entrada de la operación.
   * @param headers Entrada de la operación.
   */
  protected async perform(body: Buffer, headers: Record<string, unknown>) {
    await this.billing.receive(this.gateway.verify(body, headers));
  }
}
