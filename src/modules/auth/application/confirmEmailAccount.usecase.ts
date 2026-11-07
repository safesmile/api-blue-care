import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { AccountActionsRepository } from "../domain/account-actions.repository";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
/** Caso de uso específico de Account. */
@Injectable()
export class ConfirmEmailAccountUseCase extends EntityUseCase<[token: string], Promise<void>> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param actions Dependencia tipada de actions.
   */
  constructor(private readonly actions: AccountActionsRepository) {
    super();
  }
  /**
   *
   * @param token Entrada de la operación.
   */
  protected async perform(token: string) {
    if (!(await this.actions.confirmEmail(digest(token))))
      throw new BadRequestException("El enlace no es válido o ha vencido");
  }
}
