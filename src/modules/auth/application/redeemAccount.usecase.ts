import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { AccountActionsRepository } from "../domain/account-actions.repository";
import { PasswordHasher } from "../../identity/domain/password-hasher";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
/** Caso de uso específico de Account. */
@Injectable()
export class RedeemAccountUseCase extends EntityUseCase<
  [kind: "reset" | "activate", token: string, password: string],
  Promise<void>
> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param actions Dependencia tipada de actions.
   * @param passwords Dependencia tipada de passwords.
   */
  constructor(
    private readonly actions: AccountActionsRepository,
    private readonly passwords: PasswordHasher
  ) {
    super();
  }
  /**
   *
   * @param kind Entrada de la operación.
   * @param token Entrada de la operación.
   * @param password Entrada de la operación.
   */
  protected async perform(kind: "reset" | "activate", token: string, password: string) {
    if (!(await this.actions.redeem(digest(token), kind, await this.passwords.hash(password))))
      throw new BadRequestException("El enlace no es válido o ha vencido");
  }
}
