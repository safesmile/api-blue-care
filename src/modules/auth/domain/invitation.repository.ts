import type { Invitation } from "./invitation.entity";
import type { Page, Pagination } from "../../../shared/domain/crud.repository";
/**
 * Defines atomic invitation persistence transitions.
 */
export abstract class InvitationRepository {
  /**
   * Creates the resource using the supplied input.
   * @param invitation Value required by this operation.
   */
  abstract create(invitation: Invitation): Promise<void>;
  /**
   * Returns the resource identified by its ID.
   * @param id Resource identifier.
   */
  abstract read(id: string): Promise<Invitation | null>;
  /**
   * Applies the findByToken operation.
   * @param hash Stored token or password digest.
   */
  abstract findByToken(hash: string): Promise<Invitation | null>;
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   */
  abstract list(page: Pagination): Promise<Page<Invitation>>;
  /**
   * Consumes the current session and persists its successor atomically.
   * @param id Resource identifier.
   * @param hash Stored token or password digest.
   * @param expiresAt Value required by this operation.
   */
  abstract rotate(id: string, hash: string, expiresAt: Date): Promise<boolean>;
  /**
   * Records the result of a specific token delivery attempt.
   * @param id Resource identifier.
   * @param hash Stored token or password digest.
   * @param success Whether SMTP accepted the message.
   */
  abstract delivery(id: string, hash: string, success: boolean): Promise<void>;
  /**
   * Consumes a valid invitation and establishes verified credentials.
   * @param hash Stored token or password digest.
   * @param passwordHash Previously computed password hash.
   */
  abstract accept(hash: string, passwordHash: string): Promise<boolean>;
  /**
   * Marks the matching session as revoked.
   * @param id Resource identifier.
   */
  abstract revoke(id: string): Promise<boolean>;
}
