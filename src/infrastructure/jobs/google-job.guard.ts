import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client } from "google-auth-library";
/** Verifies Google signatures, audience and the exact authorized service identity. */
@Injectable()
export class GoogleJobGuard implements CanActivate {
  private readonly verifier = new OAuth2Client();
  /**
   *
   * @param config Validated application settings.
   */
  constructor(private readonly config: ConfigService) {}
  /**
   *
   * @param context Current HTTP execution context.
   * @returns Result of the completed operation.
   */
  async canActivate(context: ExecutionContext) {
    if (this.config.get("GCP_JOBS_ENABLED") !== "true") throw new UnauthorizedException();
    const authorization = context.switchToHttp().getRequest().headers.authorization;
    const token = typeof authorization === "string" ? /^Bearer (\S+)$/.exec(authorization)?.[1] : undefined;
    if (!token) throw new UnauthorizedException();
    try {
      const ticket = await this.verifier.verifyIdToken({
        idToken: token,
        audience: this.config.getOrThrow<string>("GCP_JOBS_AUDIENCE")
      });
      const payload = ticket.getPayload();
      if (payload?.email_verified !== true || payload.email !== this.config.getOrThrow("GCP_JOBS_SERVICE_ACCOUNT"))
        throw new Error("Invalid job identity");
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
