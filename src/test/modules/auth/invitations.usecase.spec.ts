import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { InvitationsUseCase } from "../../../modules/auth/application/invitations.usecase";
import { Invitation } from "../../../modules/auth/domain/invitation.entity";
import type { InvitationRepository } from "../../../modules/auth/domain/invitation.repository";
import type { AccountMailer } from "../../../modules/auth/domain/account-actions.repository";
import { identityFixture, userFixture } from "../../helpers/identity.fixture";
describe("InvitationsUseCase", () => {
  let repository: jest.Mocked<InvitationRepository>;
  let mail: jest.Mocked<AccountMailer>;
  let passwords: ReturnType<typeof identityFixture>["passwords"];
  let useCase: InvitationsUseCase;
  let invitation: Invitation;
  const input = {
    email: " INVITED@BLUE.TEST ",
    firstName: "Ana",
    lastName: "López",
    roles: ["customer"] as ["customer"]
  };
  const actor = { ...userFixture().toView(), roles: ["superadmin"], permissions: ["roles:assign"] as ["roles:assign"] };
  beforeEach(() => {
    invitation = new Invitation({
      email: "invited@blue.test",
      firstName: "Ana",
      lastName: "López",
      roles: ["customer"],
      tokenHash: "hash",
      invitedBy: actor.id,
      invitedByName: actor.name,
      invitedByEmail: actor.email,
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      acceptedAt: null,
      acceptedUserId: null,
      lastSendAttemptAt: null,
      lastSentAt: null,
      deliveryStatus: "pending"
    });
    repository = {
      create: jest.fn(async value => {
        invitation = value;
      }),
      read: jest.fn<Promise<Invitation | null>, [string]>(async () => invitation),
      findByToken: jest.fn<Promise<Invitation | null>, [string]>(async () => invitation),
      list: jest.fn(),
      rotate: jest.fn(),
      delivery: jest.fn(),
      accept: jest.fn(),
      revoke: jest.fn()
    };
    mail = { send: jest.fn() };
    passwords = identityFixture().passwords;
    useCase = new InvitationsUseCase(repository, mail, passwords);
  });
  it("records names, inviter, state and lifetime, while emailing the raw credential", async () => {
    const view = await useCase.create(input, actor);
    const [email, kind, token, context] = mail.send.mock.calls[0];
    expect(email).toBe("invited@blue.test");
    expect(kind).toBe("invite");
    expect(token).toMatch(/^[a-f0-9]{80}$/);
    expect(context).toMatchObject({ firstName: "Ana", lastName: "López", invitedByName: actor.name });
    expect(invitation.props.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(view).not.toHaveProperty("tokenHash");
    expect(view.invitedBy).toBe(actor.id);
    expect(repository.delivery).toHaveBeenCalledWith(invitation.id, invitation.props.tokenHash, true);
  });
  it("lists safe invitation metadata with pagination", async () => {
    repository.list.mockResolvedValue({ items: [invitation], total: 1 });
    const result = await useCase.list({ limit: 25, offset: 0 });
    expect(result.items[0]).not.toHaveProperty("tokenHash");
    expect(result.total).toBe(1);
  });
  it("previews a live token without exposing inviter details", async () => {
    const result = await useCase.preview("token");
    expect(result).toMatchObject({
      email: "invited@blue.test",
      firstName: "Ana",
      lastName: "López",
      status: "pending"
    });
    expect(result).not.toHaveProperty("invitedByEmail");
  });
  it("sets the password through one atomic redemption", async () => {
    repository.accept.mockResolvedValue(true);
    await useCase.accept("token", "Abcd123!");
    expect(passwords.hash).toHaveBeenCalledWith("Abcd123!");
    expect(repository.accept).toHaveBeenCalledWith(createHash("sha256").update("token").digest("hex"), "new-hash");
  });
  it("rejects a token consumed concurrently", async () => {
    repository.accept.mockResolvedValue(false);
    await expect(useCase.accept("token", "Abcd123!")).rejects.toBeInstanceOf(GoneException);
  });
  it("rejects unknown tokens", async () => {
    repository.findByToken.mockResolvedValue(null);
    await expect(useCase.preview("bad")).rejects.toBeInstanceOf(NotFoundException);
  });
  it.each(["accepted", "revoked", "expired"] as const)("rejects %s invitations", async status => {
    invitation.props.status = status;
    await expect(useCase.preview("token")).rejects.toBeInstanceOf(GoneException);
  });
  it("rejects time-expired invitations even when their stored status is pending", async () => {
    invitation.props.expiresAt = new Date(0);
    await expect(useCase.preview("token")).rejects.toBeInstanceOf(GoneException);
  });
  it("resends with a rotated credential and new validity", async () => {
    repository.rotate.mockResolvedValue(true);
    await useCase.resend(invitation.id, actor);
    expect(repository.rotate).toHaveBeenCalledWith(invitation.id, expect.any(String), expect.any(Date));
    expect(mail.send).toHaveBeenCalled();
  });
  it("rejects resends within cooldown or after closure", async () => {
    repository.rotate.mockResolvedValue(false);
    await expect(useCase.resend(invitation.id, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(mail.send).not.toHaveBeenCalled();
  });
  it("revokes pending invitations", async () => {
    repository.revoke.mockResolvedValue(true);
    await useCase.revoke(invitation.id);
    expect(repository.revoke).toHaveBeenCalledWith(invitation.id);
  });
  it("rejects missing invitations and closed revocations", async () => {
    repository.read.mockResolvedValueOnce(null);
    await expect(useCase.revoke("missing")).rejects.toBeInstanceOf(NotFoundException);
    repository.revoke.mockResolvedValue(false);
    await expect(useCase.revoke(invitation.id)).rejects.toBeInstanceOf(ConflictException);
  });
  it("requires role-grant authority and reserves superadmin invitations", async () => {
    await expect(useCase.create(input, { ...actor, permissions: [] })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      useCase.create({ ...input, roles: ["superadmin"] }, { ...actor, roles: ["admin"] })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("records failed mail delivery and allows the operator to retry later", async () => {
    mail.send.mockRejectedValue(new Error("SMTP unavailable"));
    await expect(useCase.create(input, actor)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repository.delivery).toHaveBeenCalledWith(invitation.id, invitation.props.tokenHash, false);
  });
  it("does not email an invitation that could not be persisted", async () => {
    repository.create.mockRejectedValue(new ConflictException());
    await expect(useCase.create(input, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(mail.send).not.toHaveBeenCalled();
  });
});
