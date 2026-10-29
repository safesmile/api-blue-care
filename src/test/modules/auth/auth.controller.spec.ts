import type { INestApplication } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import request from "supertest";
import { AuthController } from "../../../modules/auth/presentation/auth.controller";
import { AuthUseCase } from "../../../modules/auth/application/auth.usecase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
import type { AuthRequest } from "../../../modules/auth/presentation/auth.guard";
describe("AuthController", () => {
  let app: INestApplication;
  const auth = { login: jest.fn(), refresh: jest.fn(), logout: jest.fn() };
  const refreshToken = "a".repeat(80);
  beforeAll(async () => {
    app = await controllerApp(AuthController, [{ provide: AuthUseCase, useValue: auth }]);
  });
  beforeEach(() => jest.resetAllMocks());
  afterAll(async () => {
    await app.close();
  });
  it("maps login credentials to the use case and returns tokens", async () => {
    auth.login.mockResolvedValue({ token: "jwt", refreshToken });
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@blue.test", password: "password" })
      .expect(200, { token: "jwt", refreshToken });
    expect(auth.login).toHaveBeenCalledWith("admin@blue.test", "password");
  });
  it("validates login and rejects unexpected fields", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "invalid", password: "", roles: [] })
      .expect(400);
    expect(auth.login).not.toHaveBeenCalled();
  });
  it("preserves authentication errors", async () => {
    auth.login.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@blue.test", password: "wrong" })
      .expect(401);
  });
  it("renews with the refresh token", async () => {
    auth.refresh.mockResolvedValue({ token: "new", refreshToken });
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken })
      .expect(200, { token: "new", refreshToken });
    expect(auth.refresh).toHaveBeenCalledWith(refreshToken);
  });
  it.each(["refresh", "logout"])("rejects malformed tokens on %s", async route => {
    await request(app.getHttpServer())
      .post("/auth/" + route)
      .send({ refreshToken: "invalid" })
      .expect(400);
    expect(auth[route]).not.toHaveBeenCalled();
  });
  it("logs out with a 204 response", async () => {
    await request(app.getHttpServer()).post("/auth/logout").send({ refreshToken }).expect(204);
    expect(auth.logout).toHaveBeenCalledWith(refreshToken);
  });
  it("returns the authenticated profile supplied by the guard", () => {
    const user = userFixture().toView();
    const controller = new AuthController(auth as unknown as AuthUseCase);
    expect(controller.me({ user } as AuthRequest)).toEqual(user);
  });
});
