import { BadRequestException, ConflictException, Logger, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { AccountActionsUseCase } from "../../../modules/auth/application/account-actions.usecase";
import type { AccountActionsRepository, AccountMailer } from "../../../modules/auth/domain/account-actions.repository";
import { identityFixture, userFixture } from "../../helpers/identity.fixture";
describe("AccountActionsUseCase", () => {
  let dependencies: ReturnType<typeof identityFixture>;
  let actions: jest.Mocked<AccountActionsRepository>;
  let mail: jest.Mocked<AccountMailer>;
  let useCase: AccountActionsUseCase;
  beforeEach(() => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    dependencies = identityFixture();
    actions = { save: jest.fn(), redeem: jest.fn(), changePassword: jest.fn(), confirmEmail: jest.fn() };
    mail = { send: jest.fn() };
    useCase = new AccountActionsUseCase(actions, mail, dependencies.users, dependencies.passwords);
  });
  it("emails a hashed one-use recovery token only to a verified registered contact", async () => {
    const user = userFixture();
    dependencies.users.findByEmail.mockResolvedValue(user);
    const before = Date.now();
    await useCase.forgotPassword(" ADMIN@BLUE.TEST ");
    const [email, kind, token] = mail.send.mock.calls[0];
    expect(email).toBe(user.props.email);
    expect(kind).toBe("reset");
    expect(token).toMatch(/^[a-f0-9]{80}$/);
    expect(actions.save.mock.calls[0][0]).toMatchObject({
      userId: user.id,
      hash: createHash("sha256").update(token).digest("hex")
    });
    expect(actions.save.mock.calls[0][0].expiresAt.getTime()).toBeGreaterThanOrEqual(before + 1800000);
  });
  it.each(["missing", "disabled", "unverified"])("does not send recovery for %s accounts", async state => {
    const user = userFixture(state !== "disabled");
    user.props.verified = state !== "unverified";
    dependencies.users.findByEmail.mockResolvedValue(state === "missing" ? null : user);
    await useCase.forgotPassword("a@blue.test");
    expect(mail.send).not.toHaveBeenCalled();
  });
  it("activates only an existing unverified customer contact", async () => {
    const user = userFixture();
    user.props.verified = false;
    dependencies.users.findByEmail.mockResolvedValue(user);
    await useCase.requestActivation(" ADMIN@BLUE.TEST ");
    expect(mail.send).toHaveBeenCalledWith(user.props.email, "activate", expect.any(String));
    expect(actions.save.mock.calls[0][0].userId).toBe(user.id);
  });
  it.each(["missing", "disabled", "verified", "unassigned"])("does not activate %s identities", async state => {
    const user = userFixture(state !== "disabled");
    user.props.verified = state === "verified";
    user.props.roles = state === "unassigned" ? [] : ["customer"];
    dependencies.users.findByEmail.mockResolvedValue(state === "missing" ? null : user);
    await useCase.requestActivation("a@blue.test");
    expect(mail.send).not.toHaveBeenCalled();
  });
  it.each(["activate", "reset"] as const)("redeems %s only through the atomic repository", async kind => {
    actions.redeem.mockResolvedValue(true);
    await useCase.redeem(kind, "token", "password");
    expect(actions.redeem).toHaveBeenCalledWith(createHash("sha256").update("token").digest("hex"), kind, "new-hash");
  });
  it("rejects invalid verification tokens", async () => {
    actions.redeem.mockResolvedValue(false);
    await expect(useCase.redeem("reset", "bad", "password")).rejects.toBeInstanceOf(BadRequestException);
    actions.confirmEmail.mockResolvedValue(false);
    await expect(useCase.confirmEmail("bad")).rejects.toBeInstanceOf(BadRequestException);
  });
  it("changes the authenticated password and rejects concurrent credential changes", async () => {
    const user = userFixture();
    dependencies.users.read.mockResolvedValue(user);
    actions.changePassword.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await useCase.changePassword(user.id, "old", "new");
    expect(actions.changePassword).toHaveBeenCalledWith(user.id, user.props.passwordHash, "new-hash");
    await expect(useCase.changePassword(user.id, "old", "new")).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it.each(["missing", "disabled", "unverified", "wrong-password"])(
    "rejects %s when verifying the current account",
    async state => {
      const user = userFixture(state !== "disabled");
      user.props.verified = state !== "unverified";
      dependencies.users.read.mockResolvedValue(state === "missing" ? null : user);
      dependencies.passwords.compare.mockResolvedValue(state !== "wrong-password");
      await expect(useCase.changePassword(user.id, "bad", "new")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(actions.changePassword).not.toHaveBeenCalled();
    }
  );
  it("sends new email verification bound to the current account without changing it", async () => {
    const user = userFixture();
    dependencies.users.read.mockResolvedValue(user);
    await useCase.requestEmailChange(user.id, " NEW@BLUE.TEST ", "password");
    expect(actions.save.mock.calls[0][0]).toMatchObject({
      userId: user.id,
      email: user.props.email,
      targetEmail: "new@blue.test",
      kind: "email-change"
    });
    expect(mail.send).toHaveBeenCalledWith("new@blue.test", "email-change", expect.any(String));
    expect(dependencies.users.update).not.toHaveBeenCalled();
  });
  it("rejects unchanged and already registered emails", async () => {
    const user = userFixture();
    dependencies.users.read.mockResolvedValue(user);
    await expect(useCase.requestEmailChange(user.id, user.props.email, "password")).rejects.toBeInstanceOf(
      BadRequestException
    );
    dependencies.users.findByEmail.mockResolvedValue(user);
    await expect(useCase.requestEmailChange(user.id, "used@blue.test", "password")).rejects.toBeInstanceOf(
      ConflictException
    );
  });
  it("confirms a verified new channel through one-use token consumption", async () => {
    actions.confirmEmail.mockResolvedValue(true);
    await useCase.confirmEmail("token");
    expect(actions.confirmEmail).toHaveBeenCalledWith(createHash("sha256").update("token").digest("hex"));
  });
  it("does not disclose account existence through persistence or delivery failure", async () => {
    dependencies.users.findByEmail.mockResolvedValue(userFixture());
    actions.save.mockRejectedValueOnce(new Error("write failed"));
    await expect(useCase.forgotPassword("a@blue.test")).resolves.toBeUndefined();
    expect(mail.send).not.toHaveBeenCalled();
    mail.send.mockRejectedValue(new Error("SMTP failed"));
    await expect(useCase.forgotPassword("a@blue.test")).resolves.toBeUndefined();
  });
});
