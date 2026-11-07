import type { INestApplication } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import request from "supertest";
import { AuthController } from "../../../modules/auth/presentation/auth.controller";
import { AuthUseCase } from "../../helpers/usecases/AuthUseCase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
import type { AuthRequest } from "../../../modules/auth/presentation/auth.guard";
describe("AuthController", () => {
  let app: INestApplication;
  const auth = { login: jest.fn(), refresh: jest.fn(), logout: jest.fn() };
  const refreshToken = "a".repeat(80);
  beforeAll(async () => {
    app = await controllerApp(
      AuthController,
      [...AuthUseCase.providers(auth)],
      Object.assign(userFixture().toView(), { mode: "staff" })
    );
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
    expect(auth.login).toHaveBeenCalledWith("admin@blue.test", "password", null);
  });
  it("validates login and rejects unexpected fields", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "invalid", password: "", roles: [] })
      .expect(400);
    expect(auth.login).not.toHaveBeenCalled();
  });
  it("preserves authentication errors", async () => {
    auth.login.mockRejectedValue(new UnauthorizedException("Debe iniciar sesión con una cuenta válida"));
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
    const controller = new AuthController(...AuthUseCase.controllerArguments(auth));
    expect(controller.me({ user } as AuthRequest)).toEqual(user);
  });
  it("rotates the current authenticated session when switching clinic selection", async () => {
    await request(app.getHttpServer()).post("/auth/switch-clinic").send({ refreshToken, clinicId: null }).expect(200);
    expect(auth.refresh).toHaveBeenCalledWith(refreshToken, null, userFixture().id, undefined);
    await request(app.getHttpServer()).post("/auth/switch-clinic").send({ refreshToken, clinicId: "bad" }).expect(400);
    await request(app.getHttpServer()).post("/auth/switch-clinic").send({ refreshToken }).expect(400);
  });
  it("rejects a requested user type and no longer exposes a portal switch", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@blue.test", password: "password", mode: "patient" })
      .expect(400);
    await request(app.getHttpServer()).post("/auth/switch-mode").send({ refreshToken, mode: "patient" }).expect(404);
    const controller = new AuthController(...AuthUseCase.controllerArguments(auth));
    expect(() =>
      controller.switchClinic({ refreshToken, clinicId: null }, { user: { mode: "patient" } } as AuthRequest)
    ).toThrow("Solo el personal puede seleccionar una clínica");
  });
});
