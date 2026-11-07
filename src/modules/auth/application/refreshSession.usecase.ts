import type { SessionMode } from "../../authorization/domain/clinic-context.repository";
import { AuthRules } from "./authRules.service";
import { ClinicContextRepository, type ContextUser } from "../../authorization/domain/clinic-context.repository";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { IdentityRepository } from "../../identity/domain/identity.repository";
import { SessionRepository } from "../domain/session.repository";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
/** Caso de uso específico de Session. */
@Injectable()
export class RefreshSessionUseCase extends EntityUseCase<
  [refreshToken: string, clinicId?: string | null, actorId?: string, sessionId?: string],
  Promise<{
    user: ContextUser | undefined;
    clinicId?: string | null | undefined;
    token: string;
    refreshToken: string;
    mode: SessionMode;
  }>
> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param users Dependencia tipada de users.
   * @param sessions Dependencia tipada de sessions.
   * @param contexts Dependencia tipada de contexts.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly users: IdentityRepository,
    private readonly sessions: SessionRepository,
    private readonly contexts: ClinicContextRepository,
    private readonly rules: AuthRules
  ) {
    super();
  }
  /**
   *
   * @param refreshToken Entrada de la operación.
   * @param clinicId Entrada de la operación.
   * @param actorId Entrada de la operación.
   * @param sessionId Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async perform(refreshToken: string, clinicId?: string | null, actorId?: string, sessionId?: string) {
    let result: Awaited<ReturnType<AuthRules["issue"]>> | undefined;
    let userContext: ContextUser | undefined;
    const rotated = await this.sessions.rotate(digest(refreshToken), async current => {
      const user = await this.users.read(current.userId);
      if (
        !user?.props.enabled ||
        !user.props.verified ||
        (actorId && (current.userId !== actorId || current.id !== sessionId))
      )
        return null;
      const selectedMode = current.mode;
      let selected = selectedMode === "patient" ? null : clinicId === undefined ? (current.clinicId ?? null) : clinicId;
      userContext = await this.contexts.resolve(user.toView(), selected, clinicId !== undefined, selectedMode);
      if (clinicId === undefined && selected && !userContext.clinics.some(clinic => clinic.id === selected)) {
        selected = null;
        userContext = await this.contexts.resolve(user.toView(), null, true, selectedMode);
      }
      result = await this.rules.issue(current.userId, current.absoluteExpiresAt, selected, userContext.mode);
      return result.session;
    });
    if (!rotated || !result) throw new UnauthorizedException("La sesión no es válida; vuelva a iniciar sesión");
    return {
      token: result.token,
      refreshToken: result.refreshToken,
      mode: result.session.mode,
      ...(result.session.mode === "staff" ? { clinicId: result.session.clinicId ?? null } : {}),
      user: userContext
    };
  }
}
