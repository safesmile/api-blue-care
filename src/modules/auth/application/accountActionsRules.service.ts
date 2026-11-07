import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { AccountActionsRepository, AccountMailer, type AccountAction } from "../domain/account-actions.repository";
import { IdentityRepository } from "../../identity/domain/identity.repository";
import { PasswordHasher } from "../../identity/domain/password-hasher";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
/** Reglas internas compartidas; no es una fachada de casos de uso. */
@Injectable()
export class AccountActionsRules {
  private readonly logger = new Logger(AccountActionsRules.name);
  /**
   * Recibe los puertos de negocio.
   * @param actions Puerto tipado.
   * @param mail Puerto tipado.
   * @param users Puerto tipado.
   * @param passwords Puerto tipado.
   */
  constructor(
    private readonly actions: AccountActionsRepository,
    private readonly mail: AccountMailer,
    private readonly users: IdentityRepository,
    private readonly passwords: PasswordHasher
  ) {}
  /**
   * Regla interna compartida.
   * @param userId Entrada tipada de negocio.
   * @param password Entrada tipada de negocio.
   * @returns Resultado de negocio.
   */
  async authenticatedUser(userId: string, password: string) {
    const user = await this.users.read(userId);
    if (
      !user?.props.enabled ||
      !user.props.verified ||
      !(await this.passwords.compare(password, user.props.passwordHash))
    )
      throw new UnauthorizedException("Las credenciales no son válidas");
    return user;
  }
  /**
   * Regla interna compartida.
   * @param input Entrada tipada de negocio.
   */
  async publicIssue(input: Pick<AccountAction, "email" | "userId" | "kind">) {
    try {
      await this.issue(input);
    } catch {
      this.logger.warn("Account verification delivery could not be completed");
    }
  }
  /**
   * Regla interna compartida.
   * @param input Entrada tipada de negocio.
   */
  async issue(input: Pick<AccountAction, "email" | "userId" | "kind" | "targetEmail">) {
    const token = randomBytes(40).toString("hex");
    await this.actions.save({
      ...input,
      name: "",
      roles: [],
      hash: digest(token),
      expiresAt: new Date(Date.now() + 1800000)
    });
    await this.mail.send(input.targetEmail ?? input.email, input.kind, token);
  }
}
