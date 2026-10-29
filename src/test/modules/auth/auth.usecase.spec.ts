import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { AuthUseCase } from "../../../modules/auth/application/auth.usecase";
import type { SessionRepository, Session } from "../../../modules/auth/domain/session.repository";
import { identityFixture, userFixture } from "../../helpers/identity.fixture";
describe("AuthUseCase", () => {
  let dependencies: ReturnType<typeof identityFixture>;
  let sessions: jest.Mocked<SessionRepository>;
  let jwt: JwtService;
  let useCase: AuthUseCase;
  const current: Session = {
    id: "session",
    userId: userFixture().id,
    tokenHash: "hash",
    expiresAt: new Date(Date.now() + 10000),
    absoluteExpiresAt: new Date(Date.now() + 30000),
    revoked: false
  };
  beforeEach(() => {
    dependencies = identityFixture();
    sessions = { create: jest.fn(), rotate: jest.fn(), revoke: jest.fn(), isActive: jest.fn() };
    jwt = new JwtService({ secret: "test-secret" });
    useCase = new AuthUseCase(
      dependencies.users,
      dependencies.passwords,
      sessions,
      jwt,
      new ConfigService({
        ACCESS_TOKEN_SECONDS: "900",
        REFRESH_TOKEN_SECONDS: "604800",
        SESSION_MAX_SECONDS: "2592000"
      })
    );
  });
  it("issues a signed token and persists only the refresh hash", async () => {
    const user = userFixture();
    dependencies.users.findByEmail.mockResolvedValue(user);
    const result = await useCase.login(" ADMIN@BLUE.TEST ", "password");
    expect(dependencies.users.findByEmail).toHaveBeenCalledWith("admin@blue.test");
    const session = sessions.create.mock.calls[0][0];
    expect(jwt.verify(result.token, { issuer: "blue-dent", audience: "blue-dent-api" })).toMatchObject({
      sub: user.id,
      sid: session.id
    });
    expect(result.refreshToken).toMatch(/^[a-f0-9]{80}$/);
    expect(session.tokenHash).toBe(createHash("sha256").update(result.refreshToken).digest("hex"));
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(session.absoluteExpiresAt.getTime());
    expect(result.user).not.toHaveProperty("passwordHash");
  });
  it.each(["missing", "disabled", "wrong-password"])("rejects %s without creating a session", async reason => {
    dependencies.users.findByEmail.mockResolvedValue(reason === "missing" ? null : userFixture(reason !== "disabled"));
    dependencies.passwords.compare.mockResolvedValue(reason !== "wrong-password");
    await expect(useCase.login("a@blue.test", "bad")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(dependencies.passwords.compare).toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });
  it("rotates through the atomic repository operation and keeps the absolute expiry", async () => {
    dependencies.users.read.mockResolvedValue(userFixture());
    sessions.rotate.mockImplementation(async (_hash, replace) => {
      const next = await replace(current);
      expect(next?.absoluteExpiresAt).toEqual(current.absoluteExpiresAt);
      expect(next?.expiresAt).toEqual(current.absoluteExpiresAt);
      return true;
    });
    const result = await useCase.refresh("old-refresh");
    expect(result.refreshToken).toMatch(/^[a-f0-9]{80}$/);
    expect(result.token).toBeTruthy();
    expect(sessions.rotate.mock.calls[0][0]).toBe(createHash("sha256").update("old-refresh").digest("hex"));
  });
  it.each([null, false])("does not renew missing or disabled accounts (%s)", async enabled => {
    dependencies.users.read.mockResolvedValue(enabled === null ? null : userFixture(false));
    sessions.rotate.mockImplementation(async (_hash, replace) => {
      expect(await replace(current)).toBeNull();
      return false;
    });
    await expect(useCase.refresh("old")).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it("rejects consumed or expired refresh tokens", async () => {
    sessions.rotate.mockResolvedValue(false);
    await expect(useCase.refresh("expired")).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it("rejects a rotation with no replacement", async () => {
    sessions.rotate.mockResolvedValue(true);
    await expect(useCase.refresh("invalid")).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it("hashes the supplied refresh token before revocation", async () => {
    await useCase.logout("refresh");
    expect(sessions.revoke).toHaveBeenCalledWith(createHash("sha256").update("refresh").digest("hex"));
  });
  it("propagates persistence failure instead of returning an unpersisted session", async () => {
    dependencies.users.findByEmail.mockResolvedValue(userFixture());
    sessions.create.mockRejectedValue(new Error("write failed"));
    await expect(useCase.login("a@blue.test", "pass")).rejects.toThrow("write failed");
  });
  it("rejects unverified accounts at login and refresh", async () => {
    const user = userFixture();
    user.props.verified = false;
    dependencies.users.findByEmail.mockResolvedValue(user);
    await expect(useCase.login("a@blue.test", "password")).rejects.toBeInstanceOf(UnauthorizedException);
    dependencies.users.read.mockResolvedValue(user);
    sessions.rotate.mockImplementation(async (_hash, replace) => {
      expect(await replace(current)).toBeNull();
      return false;
    });
    await expect(useCase.refresh("old")).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
