import { Column, DataType, Model, PrimaryKey, Table } from "sequelize-typescript";
/**
 * Maps the resource to its PostgreSQL table.
 */
@Table({ tableName: "users", timestamps: true })
export class UserModel extends Model {
  @Column({ type: DataType.STRING(60), allowNull: false }) declare firstName: string;
  @Column({ type: DataType.STRING(60), allowNull: false }) declare lastName: string;
  @Column({ type: DataType.BOOLEAN, allowNull: false }) declare verified: boolean;
  @PrimaryKey @Column(DataType.UUID) declare id: string;
  @Column({ type: DataType.STRING(254), allowNull: false, unique: true })
  declare email: string;
  @Column({ type: DataType.STRING(120), allowNull: false })
  declare name: string;
  @Column({ type: DataType.STRING, allowNull: false })
  declare passwordHash: string;
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare enabled: boolean;
}
