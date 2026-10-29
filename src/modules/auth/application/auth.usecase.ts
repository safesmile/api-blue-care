import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { IdentityRepository } from "../../identity/domain/identity.repository";
import { PasswordHasher } from "../../identity/domain/password-hasher";
import { SessionRepository, type Session } from "../domain/session.repository";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
/**
 * Authenticates users and rotates persisted sessions.
 */
@Injectable()
export class AuthUseCase {
  private readonly dummyHash: Promise<string>;
  /**
   * Receives the dependencies required by this component.
   * @param users User repository or user application service.
   * @param passwords Password hashing adapter.
   * @param sessions Persisted session repository.
   * @param jwt JWT signing and verification service.
   * @param config Validated application configuration.
   */
  constructor(
    private readonly users: IdentityRepository,
    private readonly passwords: PasswordHasher,
    private readonly sessions: SessionRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {
    this.dummyHash = passwords.hash(randomBytes(32).toString("hex"));
  }
  /**
   * Validates credentials and creates a persisted session.
   * @param email Account email address.
   * @param password Plaintext password supplied by the caller.
   * @returns Access credentials for the new session.
   */
  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    const valid = await this.passwords.compare(password, user?.props.passwordHash ?? (await this.dummyHash));
    if (!user?.props.enabled || !user.props.verified || !valid) throw new UnauthorizedException("Invalid credentials");
    const result = await this.issue(user.id);
    await this.sessions.create(result.session);
    return {
      token: result.token,
      refreshToken: result.refreshToken,
      user: user.toView()
    };
  }
  /**
   * Consumes a refresh token and returns its replacement credentials.
   * @param refreshToken Opaque refresh credential supplied by the caller.
   * @returns Access credentials for the new session.
   */
  async refresh(refreshToken: string) {
    let result: Awaited<ReturnType<AuthUseCase["issue"]>> | undefined;
    const rotated = await this.sessions.rotate(digest(refreshToken), async current => {
      const user = await this.users.read(current.userId);
      if (!user?.props.enabled || !user.props.verified) return null;
      result = await this.issue(current.userId, current.absoluteExpiresAt);
      return result.session;
    });
    if (!rotated || !result) throw new UnauthorizedException("Invalid refresh token");
    return { token: result.token, refreshToken: result.refreshToken };
  }
  /**
   * Revokes the session identified by a refresh token.
   * @param refreshToken Opaque refresh credential supplied by the caller.
   */
  async logout(refreshToken: string) {
    await this.sessions.revoke(digest(refreshToken));
  }
  /**
   * Creates a fresh token with a bounded lifetime.
   * @param userId Identifier of the session owner.
   * @param absoluteExpiresAt Absolute session deadline that renewal must preserve.
   * @returns Result of the completed operation.
   */
  private async issue(
    userId: string,
    absoluteExpiresAt = new Date(Date.now() + Number(this.config.getOrThrow("SESSION_MAX_SECONDS")) * 1000)
  ) {
    const refreshToken = randomBytes(40).toString("hex");
    const session: Session = {
      id: randomUUID(),
      userId,
      tokenHash: digest(refreshToken),
      expiresAt: new Date(
        Math.min(
          Date.now() + Number(this.config.getOrThrow("REFRESH_TOKEN_SECONDS")) * 1000,
          absoluteExpiresAt.getTime()
        )
      ),
      absoluteExpiresAt,
      revoked: false
    };
    const token = await this.jwt.signAsync(
      { sub: userId, sid: session.id },
      {
        expiresIn: Number(this.config.getOrThrow("ACCESS_TOKEN_SECONDS")),
        issuer: "blue-dent",
        audience: "blue-dent-api",
        algorithm: "HS256"
      }
    );
    return { token, refreshToken, session };
  }
}
