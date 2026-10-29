import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AuthGuard } from "../../../modules/auth/presentation/auth.guard";
import type { SessionRepository } from "../../../modules/auth/domain/session.repository";
import { identityFixture, userFixture } from "../../helpers/identity.fixture";
import type { Permission } from "../../../shared/domain/permission";
describe("AuthGuard role authorization", () => {
  const jwt = new JwtService({ secret: "unit-test-secret" });
  let dependencies: ReturnType<typeof identityFixture>;
  let sessions: jest.Mocked<SessionRepository>;
  let guard: AuthGuard;
  beforeEach(() => {
    dependencies = identityFixture();
    sessions = { create: jest.fn(), rotate: jest.fn(), revoke: jest.fn(), isActive: jest.fn().mockResolvedValue(true) };
    guard = new AuthGuard(new Reflector(), jwt, dependencies.users, sessions);
  });
  /**
   * Builds a request context with real permission metadata.
   * @param permission Required operation.
   * @param body Request body.
   * @param publicRoute Whether the route is public.
   * @returns The execution context and its mutable request.
   */
  function context(permission: Permission | null = "auth:me", body: object = {}, publicRoute = false) {
    const handler = () => undefined;
    if (permission) Reflect.defineMetadata("permissions", [permission], handler);
    Reflect.defineMetadata("public", publicRoute, handler);
    const request = {
      headers: {
        authorization:
          "Bearer " +
          jwt.sign({ sub: userFixture().id, sid: "session" }, { issuer: "blue-dent", audience: "blue-dent-api" })
      },
      body,
      params: { id: "target" },
      user: undefined
    };
    return {
      request,
      value: {
        getHandler: () => handler,
        getClass: () => AuthGuard,
        switchToHttp: () => ({ getRequest: () => request })
      } as unknown as ExecutionContext
    };
  }
  it("permits explicit public routes without authentication", async () => {
    const ctx = context(null, {}, true);
    ctx.request.headers.authorization = "";
    expect(await guard.canActivate(ctx.value)).toBe(true);
  });
  it("rejects missing and forged credentials", async () => {
    for (const authorization of ["", "Bearer forged"]) {
      const ctx = context();
      ctx.request.headers.authorization = authorization;
      await expect(guard.canActivate(ctx.value)).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });
  it("rejects inactive sessions", async () => {
    sessions.isActive.mockResolvedValue(false);
    await expect(guard.canActivate(context().value)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it("rejects disabled accounts", async () => {
    dependencies.users.read.mockResolvedValue(userFixture(false));
    await expect(guard.canActivate(context().value)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it("requires an explicit policy and the current effective permission", async () => {
    dependencies.users.read.mockResolvedValue(userFixture());
    await expect(guard.canActivate(context(null).value)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(context().value)).rejects.toBeInstanceOf(ForbiddenException);
    const own = context("users:read");
    own.request.params.id = userFixture().id;
    expect(await guard.canActivate(own.value)).toBe(true);
  });
  it("requires roles:assign and reserves superadmin assignment", async () => {
    const user = userFixture();
    user.props.roles = ["admin"];
    user.props.permissions.push("users:create");
    dependencies.users.read.mockResolvedValue(user);
    await expect(guard.canActivate(context("users:create", { roles: ["customer"] }).value)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    user.props.permissions.push("roles:assign");
    await expect(guard.canActivate(context("users:create", { roles: ["superadmin"] }).value)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(await guard.canActivate(context("users:create", { roles: ["customer"] }).value)).toBe(true);
  });
  it("prevents a non-superadmin from modifying superadmin accounts", async () => {
    const actor = userFixture();
    actor.props.roles = ["admin"];
    actor.props.permissions.push("users:update");
    const target = userFixture();
    target.props.roles = ["superadmin"];
    dependencies.users.read.mockResolvedValueOnce(actor).mockResolvedValueOnce(target);
    await expect(guard.canActivate(context("users:update").value)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("permits superadmin role assignment with its catalog grants", async () => {
    const actor = userFixture();
    actor.props.roles = ["superadmin"];
    actor.props.permissions.push("roles:assign", "users:create");
    dependencies.users.read.mockResolvedValue(actor);
    expect(await guard.canActivate(context("users:create", { roles: ["superadmin"] }).value)).toBe(true);
  });
  it("requires ownership even when a customer has a user-read permission", async () => {
    const customer = userFixture();
    dependencies.users.read.mockResolvedValue(customer);
    const other = context("users:read");
    other.request.params.id = "another-account";
    await expect(guard.canActivate(other.value)).rejects.toBeInstanceOf(ForbiddenException);
    const own = context("users:read");
    own.request.params.id = customer.id;
    expect(await guard.canActivate(own.value)).toBe(true);
    customer.props.verified = false;
    await expect(guard.canActivate(own.value)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
