import { InvitationsController } from "../../../modules/auth/presentation/invitations.controller";
import { InvitationsUseCase } from "../../../modules/auth/application/invitations.usecase";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { AuthController } from "../../../modules/auth/presentation/auth.controller";
import { AccountActionsController } from "../../../modules/auth/presentation/account-actions.controller";
import { AuthUseCase } from "../../../modules/auth/application/auth.usecase";
import { AccountActionsUseCase } from "../../../modules/auth/application/account-actions.usecase";
import { PUBLIC_USE_CASES } from "../../../modules/auth/presentation/auth.throttle";
describe("Public endpoint throttling", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])],
      controllers: [AuthController, AccountActionsController, InvitationsController],
      providers: [
        { provide: InvitationsUseCase, useValue: { accept: jest.fn(), preview: jest.fn() } },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: AuthUseCase, useValue: { login: jest.fn(), refresh: jest.fn(), logout: jest.fn() } },
        {
          provide: AccountActionsUseCase,
          useValue: {
            forgotPassword: jest.fn(),
            requestActivation: jest.fn(),
            redeem: jest.fn(),
            confirmEmail: jest.fn()
          }
        }
      ]
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it.each([
    ["login", PUBLIC_USE_CASES.login.limit, 200, { email: "a@blue.test", password: "password" }],
    ["refresh", PUBLIC_USE_CASES.refresh.limit, 200, { refreshToken: "a".repeat(80) }],
    ["logout", PUBLIC_USE_CASES.logout.limit, 204, { refreshToken: "a".repeat(80) }],
    [
      "invitations/accept",
      PUBLIC_USE_CASES.acceptInvitation.limit,
      204,
      { token: "a".repeat(80), password: "Password12345!" }
    ],
    ["activation/request", PUBLIC_USE_CASES.activation.limit, 202, { email: "a@blue.test" }],
    [
      "activation/confirm",
      PUBLIC_USE_CASES.activation.limit,
      204,
      { token: "a".repeat(80), password: "Password12345!" }
    ],
    ["email/confirm", PUBLIC_USE_CASES.activation.limit, 204, { token: "a".repeat(80) }],
    ["password/forgot", PUBLIC_USE_CASES.forgotPassword.limit, 202, { email: "a@blue.test" }],
    ["password/reset", PUBLIC_USE_CASES.resetPassword.limit, 204, { token: "a".repeat(80), password: "Password12345!" }]
  ] as const)("returns 429 after the configured public %s budget", async (route, limit, status, body) => {
    for (let count = 0; count < limit; count++)
      await request(app.getHttpServer())
        .post("/auth/" + route)
        .send(body)
        .expect(status);
    await request(app.getHttpServer())
      .post("/auth/" + route)
      .send(body)
      .expect(429);
  });
  it("also throttles public URL-token previews", async () => {
    for (let attempt = 0; attempt < PUBLIC_USE_CASES.previewInvitation.limit; attempt++)
      await request(app.getHttpServer())
        .get("/auth/invitations/by-token")
        .query({ token: "a".repeat(80) })
        .expect(200);
    await request(app.getHttpServer())
      .get("/auth/invitations/by-token")
      .query({ token: "a".repeat(80) })
      .expect(429);
  });
});
