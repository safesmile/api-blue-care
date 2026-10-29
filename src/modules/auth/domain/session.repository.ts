export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revoked: boolean;
}
/**
 * Defines the persistence operations required by the domain.
 */
export abstract class SessionRepository {
  /**
   * Creates the resource using the supplied input.
   * @param session Session data to persist.
   */
  abstract create(session: Session): Promise<void>;
  // Atomically consume the old token and insert its successor.
  /**
   * Consumes the current session and persists its successor atomically.
   * @param hash Stored token or password digest.
   * @param replacement Callback that builds the successor while the current row is locked.
   */
  abstract rotate(hash: string, replacement: (current: Session) => Promise<Session | null>): Promise<boolean>;
  /**
   * Checks session ownership, revocation and expiration.
   * @param id Resource identifier.
   * @param userId Identifier of the session owner.
   */
  abstract isActive(id: string, userId: string): Promise<boolean>;
  /**
   * Marks the matching session as revoked.
   * @param hash Stored token or password digest.
   */
  abstract revoke(hash: string): Promise<void>;
}
