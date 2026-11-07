import { AccountActionsRules } from "./accountActionsRules.service";
import { Injectable, Logger } from "@nestjs/common";
import { IdentityRepository } from "../../identity/domain/identity.repository";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
/** Caso de uso específico de Account. */
@Injectable()
export class ForgotPasswordAccountUseCase extends EntityUseCase<[email: string], Promise<void>> {
  private readonly logger = new Logger(ForgotPasswordAccountUseCase.name);
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param users Dependencia tipada de users.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly users: IdentityRepository,
    private readonly rules: AccountActionsRules
  ) {
    super();
  }
  /**
   *
   * @param email Entrada de la operación.
   */
  protected async perform(email: string) {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (user?.props.enabled && user.props.verified)
      await this.rules.publicIssue({ email: user.props.email, userId: user.id, kind: "reset" });
  }
}
