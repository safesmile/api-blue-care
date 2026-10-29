import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { SessionRepository } from "../domain/session.repository";
import { IdentityRepository } from "../../identity/domain/identity.repository";
import type { Permission, UserView } from "../../identity/domain/user";
export type AuthRequest = Request & { user: UserView };
/**
 * Validates JWT sessions and enforces current user permissions.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /**
   * Receives the dependencies required by this component.
   * @param reflector Route metadata reader.
   * @param jwt JWT signing and verification service.
   * @param users User repository or user application service.
   * @param sessions Persisted session repository.
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: IdentityRepository,
    private readonly sessions: SessionRepository
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
    if (!match) throw new UnauthorizedException();
    let sub: string;
    let sid: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(match[1], {
        algorithms: ["HS256"],
        issuer: "blue-dent",
        audience: "blue-dent-api"
      });
      sub = payload.sub;
      sid = payload.sid;
      if (typeof sub !== "string") throw new Error();
    } catch {
      throw new UnauthorizedException();
    }
    if (typeof sid !== "string" || !(await this.sessions.isActive(sid, sub))) throw new UnauthorizedException();
    const user = await this.users.read(sub);
    if (!user?.props.enabled || !user.props.verified) throw new UnauthorizedException();
    request.user = user.toView();
    const requestedRoles: unknown = request.body?.roles;
    if (
      Array.isArray(requestedRoles) &&
      requestedRoles.includes("superadmin") &&
      !user.props.roles.includes("superadmin")
    )
      throw new ForbiddenException("Only superadmin may grant superadmin");
    const required = this.reflector.getAllAndOverride<Permission[]>("permissions", targets) ?? [];
    if (!required.length) throw new ForbiddenException("Missing route permission policy");
    const isCustomerOnly =
      user.props.roles.includes("customer") &&
      !user.props.roles.some(role => role === "admin" || role === "superadmin");
    if (isCustomerOnly && required.some(permission => permission.startsWith("users:")) && request.params.id !== user.id)
      throw new ForbiddenException("A customer can access only their own identity");
    if (requestedRoles !== undefined && !user.props.permissions.includes("roles:assign"))
      throw new ForbiddenException("Role assignment requires roles:assign");
    if (
      !user.props.roles.includes("superadmin") &&
      (required.includes("users:update") || required.includes("users:delete"))
    ) {
      const targetId = request.params.id;
      if (typeof targetId === "string") {
        const target = await this.users.read(targetId);
        if (target?.props.roles.includes("superadmin"))
          throw new ForbiddenException("Only superadmin may modify superadmin accounts");
      }
    }
    if (!required.every(p => user.props.permissions.includes(p))) throw new ForbiddenException();
    return true;
  }
}
