import { BadRequestException, type INestApplication } from "@nestjs/common";
import request from "supertest";
import { AccountActionsController } from "../../../modules/auth/presentation/account-actions.controller";
import { AccountActionsUseCase } from "../../../modules/auth/application/account-actions.usecase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("AccountActionsController", () => {
  let app: INestApplication;
  const actions = {
    forgotPassword: jest.fn(),
    requestActivation: jest.fn(),
    redeem: jest.fn(),
    changePassword: jest.fn(),
    requestEmailChange: jest.fn(),
    confirmEmail: jest.fn()
  };
  const user = userFixture().toView();
  const token = "a".repeat(80);
  beforeAll(async () => {
    app = await controllerApp(AccountActionsController, [{ provide: AccountActionsUseCase, useValue: actions }], user);
  });
  beforeEach(() => jest.resetAllMocks());
  afterAll(async () => {
    await app.close();
  });
  it.each([
    ["password/forgot", "forgotPassword"],
    ["activation/request", "requestActivation"]
  ] as const)("acknowledges %s without revealing account existence", async (route, method) => {
    await request(app.getHttpServer())
      .post("/auth/" + route)
      .send({ email: "a@blue.test" })
      .expect(202, { message: "If the account is eligible, a verification email will be sent" });
    expect(actions[method]).toHaveBeenCalledWith("a@blue.test");
  });
  it("validates the contact email", async () => {
    await request(app.getHttpServer()).post("/auth/password/forgot").send({ email: "invalid" }).expect(400);
    expect(actions.forgotPassword).not.toHaveBeenCalled();
  });
  it.each([
    ["password/reset", "reset"],
    ["activation/confirm", "activate"]
  ] as const)("consumes %s verification and enforces eight characters", async (route, kind) => {
    await request(app.getHttpServer())
      .post("/auth/" + route)
      .send({ token, password: "Abc123!" })
      .expect(400);
    expect(actions.redeem).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post("/auth/" + route)
      .send({ token, password: "Abcd123!" })
      .expect(204);
    expect(actions.redeem).toHaveBeenCalledWith(kind, token, "Abcd123!");
  });
  it("preserves invalid token errors", async () => {
    actions.redeem.mockRejectedValue(new BadRequestException());
    await request(app.getHttpServer()).post("/auth/password/reset").send({ token, password: "Abcd123!" }).expect(400);
  });
  it("changes only the authenticated account password", async () => {
    await request(app.getHttpServer())
      .post("/auth/password/change")
      .send({ currentPassword: "old", newPassword: "Abcd123!" })
      .expect(204);
    expect(actions.changePassword).toHaveBeenCalledWith(user.id, "old", "Abcd123!");
  });
  it("rejects caller-provided account identifiers", async () => {
    await request(app.getHttpServer())
      .post("/auth/password/change")
      .send({ userId: "another", currentPassword: "old", newPassword: "Abcd123!" })
      .expect(400);
    expect(actions.changePassword).not.toHaveBeenCalled();
  });
  it("requests a verified change of the authenticated email", async () => {
    await request(app.getHttpServer())
      .post("/auth/email/change")
      .send({ email: "new@blue.test", currentPassword: "old" })
      .expect(202, { message: "Verification sent to the new email" });
    expect(actions.requestEmailChange).toHaveBeenCalledWith(user.id, "new@blue.test", "old");
  });
  it("confirms the new channel with a one-use URL token", async () => {
    await request(app.getHttpServer()).post("/auth/email/confirm").send({ token }).expect(204);
    expect(actions.confirmEmail).toHaveBeenCalledWith(token);
  });
});
