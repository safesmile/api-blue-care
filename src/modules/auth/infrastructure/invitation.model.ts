import { Column, DataType, Model, PrimaryKey, Table } from "sequelize-typescript";
import type { InvitationProps, InvitationStatus } from "../domain/invitation.entity";
/**
 * Maps the resource to its PostgreSQL table.
 */
@Table({ tableName: "invitations", timestamps: false })
export class InvitationModel extends Model implements InvitationProps {
  @PrimaryKey @Column(DataType.UUID) declare id: string;
  @Column(DataType.STRING(254)) declare email: string;
  @Column(DataType.STRING(60)) declare firstName: string;
  @Column(DataType.STRING(60)) declare lastName: string;
  @Column(DataType.ARRAY(DataType.STRING)) declare roles: string[];
  @Column(DataType.STRING(64)) declare tokenHash: string;
  @Column(DataType.UUID) declare invitedBy: string | null;
  @Column(DataType.STRING(120)) declare invitedByName: string;
  @Column(DataType.STRING(254)) declare invitedByEmail: string;
  @Column(DataType.STRING) declare status: InvitationStatus;
  @Column(DataType.DATE) declare createdAt: Date;
  @Column(DataType.DATE) declare expiresAt: Date;
  @Column(DataType.DATE) declare acceptedAt: Date | null;
  @Column(DataType.UUID) declare acceptedUserId: string | null;
  @Column(DataType.DATE) declare lastSendAttemptAt: Date | null;
  @Column(DataType.DATE) declare lastSentAt: Date | null;
  @Column(DataType.STRING) declare deliveryStatus: "pending" | "sent" | "failed";
}
