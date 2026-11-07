import type { ContextUser } from "../../authorization/domain/clinic-context.repository";
import { AuthRules } from "./authRules.service";
import { ClinicContextRepository } from "../../authorization/domain/clinic-context.repository";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { IdentityRepository } from "../../identity/domain/identity.repository";
import { PasswordHasher } from "../../identity/domain/password-hasher";
import { SessionRepository } from "../domain/session.repository";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
/** Caso de uso específico de Session. */
@Injectable()
export class LoginSessionUseCase extends EntityUseCase<
  [email: string, password: string, clinicId?: string | null],
  Promise<{
    token: string;
    refreshToken: string;
    user: ContextUser;
  }>
> {
  private readonly dummyHash: Promise<string>;
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param users Dependencia tipada de users.
   * @param passwords Dependencia tipada de passwords.
   * @param sessions Dependencia tipada de sessions.
   * @param contexts Dependencia tipada de contexts.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly users: IdentityRepository,
    private readonly passwords: PasswordHasher,
    private readonly sessions: SessionRepository,
    private readonly contexts: ClinicContextRepository,
    private readonly rules: AuthRules
  ) {
    super();
    this.dummyHash = passwords.hash(randomBytes(32).toString("hex"));
  }
  /**
   *
   * @param email Entrada de la operación.
   * @param password Entrada de la operación.
   * @param clinicId Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async perform(email: string, password: string, clinicId: string | null = null) {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    const valid = await this.passwords.compare(password, user?.props.passwordHash ?? (await this.dummyHash));
    if (!user?.props.enabled || !user.props.verified || !valid)
      throw new UnauthorizedException("Las credenciales no son válidas");
    const context = await this.contexts.resolve(user.toView(), clinicId, true);
    const result = await this.rules.issue(user.id, undefined, context.clinicId ?? null, context.mode);
    await this.sessions.create(result.session);
    return {
      token: result.token,
      refreshToken: result.refreshToken,
      user: context
    };
  }
}
