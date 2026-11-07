import type { ClinicRoleAssignment } from "../../authorization/domain/clinic-context.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import { Entity } from "../../../shared/domain/entity";
import type { UserView } from "../../identity/domain/user";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type InvitationActor = Pick<UserView, "name" | "email"> & AccessActor;
export type InvitationKind = "general" | "patient" | "collaborator";
export interface InvitationProps {
  kind?: InvitationKind;
  staff?: boolean;
  patientId?: string | null;
  clinicAssignments?: ClinicRoleAssignment[];
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
      kind: this.props.kind ?? "general",
      staff: this.props.staff ?? !!this.props.clinicAssignments?.length,
      patientId: this.props.patientId ?? null,
      clinicAssignments: this.props.clinicAssignments ?? [],
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
