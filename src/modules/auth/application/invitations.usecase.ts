import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { Invitation, type InvitationActor } from "../domain/invitation.entity";
import { InvitationRepository } from "../domain/invitation.repository";
import { AccountMailer } from "../domain/account-actions.repository";
import { PasswordHasher } from "../../identity/domain/password-hasher";
import type { RoleName } from "../../../permissions";
import type { Pagination } from "../../../shared/domain/crud.repository";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export interface CreateInvitationInput {
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
}
/**
 * Coordinates invitations and verified contact redemption.
 */
@Injectable()
export class InvitationsUseCase {
  /**
   * Receives the dependencies required by this component.
   * @param invitations Invitation repository or application service.
   * @param mail Account email delivery adapter.
   * @param passwords Password hashing adapter.
   */
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly mail: AccountMailer,
    private readonly passwords: PasswordHasher
  ) {}
  /**
   * Creates the resource using the supplied input.
   * @param input Validated input for this operation.
   * @param actor Verified identity performing the operation.
   * @returns Result of the completed operation.
   */
  async create(input: CreateInvitationInput, actor: InvitationActor) {
    this.authorizeRoles(input.roles, actor);
    const token = randomBytes(40).toString("hex");
    const invitation = new Invitation({
      email: input.email.trim().toLowerCase(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      roles: input.roles,
      tokenHash: digest(token),
      invitedBy: actor.id,
      invitedByName: actor.name,
      invitedByEmail: actor.email,
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      acceptedAt: null,
      acceptedUserId: null,
      lastSendAttemptAt: new Date(),
      lastSentAt: null,
      deliveryStatus: "pending"
    });
    await this.invitations.create(invitation);
    await this.deliver(invitation, token);
    return (await this.requireInvitation(invitation.id)).toView();
  }
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   * @returns Result of the completed operation.
   */
  async list(page: Pagination) {
    const result = await this.invitations.list(page);
    return { ...result, items: result.items.map(invitation => invitation.toView()) };
  }
  /**
   * Returns the metadata of a valid invitation credential.
   * @param token Opaque one-use credential supplied by the caller.
   * @returns Result of the completed operation.
   */
  async preview(token: string) {
    return (await this.validToken(token)).preview();
  }
  /**
   * Consumes a valid invitation and establishes verified credentials.
   * @param token Opaque one-use credential supplied by the caller.
   * @param password Plaintext password supplied by the caller.
   */
  async accept(token: string, password: string) {
    await this.validToken(token);
    if (!(await this.invitations.accept(digest(token), await this.passwords.hash(password))))
      throw new GoneException("Invitation is no longer valid");
  }
  /**
   * Rotates an invitation token before delivering a new link.
   * @param id Resource identifier.
   * @param actor Verified identity performing the operation.
   * @returns Result of the completed operation.
   */
  async resend(id: string, actor: InvitationActor) {
    const invitation = await this.requireInvitation(id);
    this.authorizeRoles(invitation.props.roles, actor);
    const token = randomBytes(40).toString("hex");
    if (!(await this.invitations.rotate(id, digest(token), new Date(Date.now() + 86400000))))
      throw new ConflictException("Invitation cannot be resent; it is closed or was sent within the last minute");
    await this.deliver(await this.requireInvitation(id), token);
    return (await this.requireInvitation(id)).toView();
  }
  /**
   * Marks the matching session as revoked.
   * @param id Resource identifier.
   */
  async revoke(id: string) {
    await this.requireInvitation(id);
    if (!(await this.invitations.revoke(id))) throw new ConflictException("Invitation is already closed");
  }
  /**
   * Requires authority over the requested role assignments.
   * @param roles Role names requested by the caller.
   * @param actor Verified identity performing the operation.
   */
  private authorizeRoles(roles: string[], actor: InvitationActor) {
    if (
      !actor.permissions.includes("roles:assign") ||
      (roles.includes("superadmin") && !actor.roles.includes("superadmin"))
    )
      throw new ForbiddenException("Cannot grant these roles");
  }
  /**
   * Requires a persisted invitation for an administrative operation.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  private async requireInvitation(id: string) {
    const invitation = await this.invitations.read(id);
    if (!invitation) throw new NotFoundException("Invitation not found");
    return invitation;
  }
  /**
   * Requires a live, pending invitation credential.
   * @param token Opaque one-use credential supplied by the caller.
   * @returns Result of the completed operation.
   */
  private async validToken(token: string) {
    const invitation = await this.invitations.findByToken(digest(token));
    if (!invitation) throw new NotFoundException("Invitation not found");
    if (invitation.status() !== "pending") throw new GoneException("Invitation is no longer valid");
    return invitation;
  }
  /**
   * Sends an invitation and records its delivery result.
   * @param invitation Value required by this operation.
   * @param token Opaque one-use credential supplied by the caller.
   */
  private async deliver(invitation: Invitation, token: string) {
    try {
      await this.mail.send(invitation.props.email, "invite", token, {
        firstName: invitation.props.firstName,
        lastName: invitation.props.lastName,
        invitedByName: invitation.props.invitedByName,
        expiresAt: invitation.props.expiresAt
      });
    } catch {
      await this.invitations.delivery(invitation.id, digest(token), false);
      throw new ServiceUnavailableException(
        "Invitation saved but email delivery failed; resend from the invitations list"
      );
    }
    await this.invitations.delivery(invitation.id, digest(token), true);
  }
}
