import { AccountActionsRules } from "./accountActionsRules.service";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AccountActionsRepository } from "../domain/account-actions.repository";
import { PasswordHasher } from "../../identity/domain/password-hasher";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
/** Caso de uso específico de Account. */
@Injectable()
export class ChangePasswordAccountUseCase extends EntityUseCase<
  [userId: string, currentPassword: string, newPassword: string],
  Promise<void>
> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param actions Dependencia tipada de actions.
   * @param passwords Dependencia tipada de passwords.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly actions: AccountActionsRepository,
    private readonly passwords: PasswordHasher,
    private readonly rules: AccountActionsRules
  ) {
    super();
  }
  /**
   *
   * @param userId Entrada de la operación.
   * @param currentPassword Entrada de la operación.
   * @param newPassword Entrada de la operación.
   */
  protected async perform(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.rules.authenticatedUser(userId, currentPassword);
    if (!(await this.actions.changePassword(userId, user.props.passwordHash, await this.passwords.hash(newPassword))))
      throw new UnauthorizedException("Las credenciales cambiaron; vuelva a iniciar sesión");
  }
}
