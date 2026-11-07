import type { SessionMode } from "../../authorization/domain/clinic-context.repository";
import { ClinicContextRepository, type ContextUser } from "../../authorization/domain/clinic-context.repository";
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { SessionRepository } from "../domain/session.repository";
import { IdentityRepository } from "../../identity/domain/identity.repository";
import type { Permission } from "../../identity/domain/user";
export type AuthRequest = Request & { user: ContextUser; sessionId?: string };
/**
 * Validates JWT sessions and enforces current user permissions.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /**
   * Recibe las dependencias de la operación.
   * @param reflector Dependencia tipada de reflector.
   * @param jwt Dependencia tipada de jwt.
   * @param users Dependencia tipada de users.
   * @param sessions Dependencia tipada de sessions.
   * @param contexts Dependencia tipada de contexts.
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: IdentityRepository,
    private readonly sessions: SessionRepository,
    private readonly contexts: ClinicContextRepository
  ) {}
  /**
   * Authenticates the request and checks its required permissions.
   * @param context Current request execution context.
   * @returns Whether the required checks passed.
   */
  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>("public", targets)) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer ([^ ]+)$/.exec(request.headers.authorization ?? "");
    if (!match) throw new UnauthorizedException("Debe iniciar sesión con una cuenta válida");
    let sub: string;
    let sid: string;
    let clinicId: string | null;
    let mode: SessionMode;
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        sid: string;
        clinicId?: string | null;
        mode: SessionMode;
      }>(match[1], {
        algorithms: ["HS256"],
        issuer: "blue-dent",
        audience: "blue-dent-api"
      });
      sub = payload.sub;
      sid = payload.sid;
      mode = payload.mode;
      if (mode !== "patient" && mode !== "staff") throw new Error();
      if (mode === "patient" && payload.clinicId !== undefined) throw new Error();
      clinicId = mode === "staff" ? payload.clinicId! : null;
      if (clinicId !== null && typeof clinicId !== "string") throw new Error();
      if (typeof sub !== "string") throw new Error();
    } catch {
      throw new UnauthorizedException("Debe iniciar sesión con una cuenta válida");
    }
    if (typeof sid !== "string" || !(await this.sessions.isActive(sid, sub, clinicId, mode)))
      throw new UnauthorizedException("Debe iniciar sesión con una cuenta válida");
    const user = await this.users.read(sub);
    if (!user?.props.enabled || !user.props.verified)
      throw new UnauthorizedException("Debe iniciar sesión con una cuenta válida");
    request.user = await this.contexts.resolve(user.toView(), clinicId, false, mode);
    request.sessionId = sid;
    const required = this.reflector.getAllAndOverride<Permission[]>("permissions", targets) ?? [];
    if (!required.length) throw new ForbiddenException("La ruta no tiene una política de permisos declarada");
    if (!required.every(p => request.user.permissions.includes(p)))
      throw new ForbiddenException("No tiene permiso para realizar esta operación");
    request.user.clinicPermission = required[0];
    return true;
  }
}
