import { Column, DataType, Model, PrimaryKey, Table, ForeignKey } from "sequelize-typescript";
import { UserModel } from "../../identity/infrastructure/user.model";
/**
 * Maps the resource to its PostgreSQL table.
 */
@Table({ tableName: "sessions", timestamps: true })
export class SessionModel extends Model {
  @PrimaryKey @Column(DataType.UUID) declare id: string;
  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false })
  declare userId: string;
  @Column({ type: DataType.STRING(64), unique: true, allowNull: false })
  declare tokenHash: string;
  @Column({ type: DataType.DATE, allowNull: false }) declare expiresAt: Date;
  @Column({ type: DataType.DATE, allowNull: false })
  declare absoluteExpiresAt: Date;
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare revoked: boolean;
}
