import { ROLE_NAMES } from "../../../permissions";
import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { AccountActionsRepository, AccountMailer, type AccountAction } from "../domain/account-actions.repository";
import { IdentityRepository } from "../../identity/domain/identity.repository";
import { PasswordHasher } from "../../identity/domain/password-hasher";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
/**
 * Coordinates invitation and password recovery flows.
 */
@Injectable()
export class AccountActionsUseCase {
  private readonly logger = new Logger(AccountActionsUseCase.name);
  /**
   * Receives the dependencies required by this component.
   * @param actions Account action repository or application service.
   * @param mail Account email delivery adapter.
   * @param users User repository or user application service.
   * @param passwords Password hashing adapter.
   */
  constructor(
    private readonly actions: AccountActionsRepository,
    private readonly mail: AccountMailer,
    private readonly users: IdentityRepository,
    private readonly passwords: PasswordHasher
  ) {}
  /**
   * Requests recovery for an enabled account without returning account details.
   * @param email Account email address.
   */
  async forgotPassword(email: string) {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (user?.props.enabled && user.props.verified)
      await this.publicIssue({ email: user.props.email, userId: user.id, kind: "reset" });
  }
  /**
   * Sends verification only to an eligible registered customer contact.
   * @param email Account email address.
   */
  async requestActivation(email: string) {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (
      user?.props.enabled &&
      !user.props.verified &&
      user.props.roles.some(role => ROLE_NAMES.some(allowed => allowed === role))
    )
      await this.publicIssue({ email: user.props.email, userId: user.id, kind: "activate" });
  }
  /**
   * Consumes a one-use token to create an account or replace a password.
   * @param kind Account action to authorize.
   * @param token Opaque one-use credential supplied by the caller.
   * @param password Plaintext password supplied by the caller.
   */
  async redeem(kind: "reset" | "activate", token: string, password: string) {
    if (!(await this.actions.redeem(digest(token), kind, await this.passwords.hash(password))))
      throw new BadRequestException("Invalid or expired token");
  }
  /**
   * Changes the authenticated account credentials and revokes its sessions.
   * @param userId Identifier of the session owner.
   * @param currentPassword Current credential supplied by the account owner.
   * @param newPassword Replacement credential to hash.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.authenticatedUser(userId, currentPassword);
    if (!(await this.actions.changePassword(userId, user.props.passwordHash, await this.passwords.hash(newPassword))))
      throw new UnauthorizedException("Credentials changed; sign in again");
  }
  /**
   * Requires current credentials before verifying a new contact.
   * @param userId Identifier of the session owner.
   * @param email Account email address.
   * @param currentPassword Current credential supplied by the account owner.
   */
  async requestEmailChange(userId: string, email: string, currentPassword: string) {
    const user = await this.authenticatedUser(userId, currentPassword);
    const targetEmail = email.trim().toLowerCase();
    if (targetEmail === user.props.email) throw new BadRequestException("Email is unchanged");
    if (await this.users.findByEmail(targetEmail)) throw new ConflictException("Email already registered");
    await this.issue({ email: user.props.email, userId: user.id, kind: "email-change", targetEmail });
  }
  /**
   * Consumes new-contact verification before changing the stored email.
   * @param token Opaque one-use credential supplied by the caller.
   */
  async confirmEmail(token: string) {
    if (!(await this.actions.confirmEmail(digest(token)))) throw new BadRequestException("Invalid or expired token");
  }
  /**
   * Requires a verified account and its current credentials.
   * @param userId Identifier of the session owner.
   * @param password Plaintext password supplied by the caller.
   * @returns Result of the completed operation.
   */
  private async authenticatedUser(userId: string, password: string) {
    const user = await this.users.read(userId);
    if (
      !user?.props.enabled ||
      !user.props.verified ||
      !(await this.passwords.compare(password, user.props.passwordHash))
    )
      throw new UnauthorizedException("Invalid credentials");
    return user;
  }
  /**
   * Issues verification while keeping public responses independent of account existence.
   * @param input Validated input for this operation.
   */
  private async publicIssue(input: Pick<AccountAction, "email" | "userId" | "kind">) {
    try {
      await this.issue(input);
    } catch {
      this.logger.warn("Account verification delivery could not be completed");
    }
  }
  /**
   * Creates a fresh token with a bounded lifetime.
   * @param input Validated input for this operation.
   */
  private async issue(input: Pick<AccountAction, "email" | "userId" | "kind" | "targetEmail">) {
    const token = randomBytes(40).toString("hex");
    await this.actions.save({
      ...input,
      name: "",
      roles: [],
      hash: digest(token),
      expiresAt: new Date(Date.now() + 1800000)
    });
    await this.mail.send(input.targetEmail ?? input.email, input.kind, token);
  }
}
