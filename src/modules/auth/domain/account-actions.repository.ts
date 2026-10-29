export type AccountActionKind = "reset" | "activate" | "email-change";
export interface AccountAction {
  hash: string;
  kind: AccountActionKind;
  email: string;
  name: string;
  roles: string[];
  expiresAt: Date;
  userId?: string;
  targetEmail?: string;
}
export interface MailContext {
  firstName: string;
  lastName: string;
  invitedByName: string;
  expiresAt: Date;
}
/**
 * Defines the persistence operations required by the domain.
 */
export abstract class AccountActionsRepository {
  /**
   * Persists the account action token hash.
   * @param action Account action data to persist.
   */
  abstract save(action: AccountAction): Promise<void>;
  /**
   * Consumes a one-use token to create an account or replace a password.
   * @param hash Stored token or password digest.
   * @param kind Account action to authorize.
   * @param passwordHash Previously computed password hash.
   */
  abstract redeem(hash: string, kind: "reset" | "activate", passwordHash: string): Promise<boolean>;
  /**
   * Changes the authenticated account credentials and revokes its sessions.
   * @param userId Identifier of the session owner.
   * @param expectedHash Previously verified credential hash used for a concurrent-update check.
   * @param passwordHash Previously computed password hash.
   */
  abstract changePassword(userId: string, expectedHash: string, passwordHash: string): Promise<boolean>;
  /**
   * Consumes new-contact verification before changing the stored email.
   * @param hash Stored token or password digest.
   */
  abstract confirmEmail(hash: string): Promise<boolean>;
}
/**
 * Defines the resource contract.
 */
export abstract class AccountMailer {
  /**
   * Delivers the account action link to its recipient.
   * @param email Account email address.
   * @param kind Account action to authorize.
   * @param token Opaque one-use credential supplied by the caller.
   * @param context Invitation identity and expiry metadata.
   */
  abstract send(email: string, kind: AccountActionKind | "invite", token: string, context?: MailContext): Promise<void>;
}
