import { AccountActionsRules } from "./accountActionsRules.service";
import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { IdentityRepository } from "../../identity/domain/identity.repository";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
/** Caso de uso específico de Account. */
@Injectable()
export class RequestEmailChangeAccountUseCase extends EntityUseCase<
  [userId: string, email: string, currentPassword: string],
  Promise<void>
> {
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
   * @param userId Entrada de la operación.
   * @param email Entrada de la operación.
   * @param currentPassword Entrada de la operación.
   */
  protected async perform(userId: string, email: string, currentPassword: string) {
    const user = await this.rules.authenticatedUser(userId, currentPassword);
    const targetEmail = email.trim().toLowerCase();
    if (targetEmail === user.props.email)
      throw new BadRequestException("El correo electrónico es el mismo que el actual");
    if (await this.users.findByEmail(targetEmail))
      throw new ConflictException("El correo electrónico ya está registrado");
    await this.rules.issue({ email: user.props.email, userId: user.id, kind: "email-change", targetEmail });
  }
}
