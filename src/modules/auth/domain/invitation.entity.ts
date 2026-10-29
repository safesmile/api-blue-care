import { Entity } from "../../../shared/domain/entity";
import type { UserView } from "../../identity/domain/user";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type InvitationActor = Pick<UserView, "id" | "name" | "email" | "roles" | "permissions">;
export interface InvitationProps {
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  tokenHash: string;
  invitedBy: string | null;
  invitedByName: string;
  invitedByEmail: string;
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedUserId: string | null;
  lastSendAttemptAt: Date | null;
  lastSentAt: Date | null;
  deliveryStatus: "pending" | "sent" | "failed";
}
/**
 * Represents an invitation and its auditable lifecycle.
 */
export class Invitation extends Entity<InvitationProps> {
  /**
   * Resolves the current invitation state including expiration.
   * @returns Result of the completed operation.
   */
  status(): InvitationStatus {
    return this.props.status === "pending" && this.props.expiresAt.getTime() <= Date.now()
      ? "expired"
      : this.props.status;
  }
  /**
   * Builds a safe view without stored credential digests.
   * @returns Public user properties without credentials.
   */
  toView() {
    const {
      email,
      firstName,
      lastName,
      roles,
      invitedBy,
      invitedByName,
      invitedByEmail,
      createdAt,
      expiresAt,
      acceptedAt,
      acceptedUserId,
      lastSendAttemptAt,
      lastSentAt,
      deliveryStatus
    } = this.props;
    return {
      id: this.id,
      email,
      firstName,
      lastName,
      roles,
      invitedBy,
      invitedByName,
      invitedByEmail,
      createdAt,
      expiresAt,
      acceptedAt,
      acceptedUserId,
      lastSendAttemptAt,
      lastSentAt,
      deliveryStatus,
      status: this.status()
    };
  }
  /**
   * Returns the metadata of a valid invitation credential.
   * @returns Result of the completed operation.
   */
  preview() {
    const { email, firstName, lastName, roles, expiresAt } = this.props;
    return { email, firstName, lastName, roles, expiresAt, status: this.status() };
  }
}
