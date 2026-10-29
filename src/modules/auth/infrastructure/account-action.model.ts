import { Column, DataType, Model, PrimaryKey, Table } from "sequelize-typescript";
/**
 * Maps the resource to its PostgreSQL table.
 */
@Table({ tableName: "account_actions", timestamps: true })
export class AccountActionModel extends Model {
  @Column(DataType.UUID) declare userId: string | null;
  @Column(DataType.STRING(254)) declare targetEmail: string | null;
  @PrimaryKey @Column(DataType.STRING(64)) declare hash: string;
  @Column(DataType.STRING) declare kind: "reset" | "activate" | "email-change";
  @Column(DataType.STRING) declare email: string;
  @Column(DataType.STRING) declare name: string;
  @Column(DataType.ARRAY(DataType.STRING)) declare roles: string[];
  @Column(DataType.DATE) declare expiresAt: Date;
}
