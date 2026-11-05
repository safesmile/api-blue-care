import type { QueryInterface } from "sequelize";
import type * as SequelizeTypes from "sequelize";
export = {
  async up(q: QueryInterface, S: typeof SequelizeTypes) {
    await q.sequelize.transaction(async transaction => {
      await q.createTable(
        "clinics",
        {
          id: { type: S.UUID, primaryKey: true },
          code: { type: S.STRING(30), allowNull: false, unique: true },
          name: { type: S.STRING(120), allowNull: false },
          address: { type: S.STRING(500), allowNull: true },
          phone: { type: S.STRING(30), allowNull: true },
          email: { type: S.STRING(254), allowNull: true },
          enabled: { type: S.BOOLEAN, allowNull: false, defaultValue: true },
          createdAt: { type: S.DATE, allowNull: false },
          updatedAt: { type: S.DATE, allowNull: false }
        },
        { transaction }
      );
      await q.createTable(
        "clinic_staff",
        {
          clinicId: {
            type: S.UUID,
            primaryKey: true,
            references: { model: "clinics", key: "id" },
            onDelete: "RESTRICT"
          },
          userId: { type: S.UUID, primaryKey: true, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
          createdAt: { type: S.DATE, allowNull: false }
        },
        { transaction }
      );
      await q.addIndex("clinic_staff", ["userId", "clinicId"], { transaction });
      await q.createTable(
        "patients",
        {
          id: { type: S.UUID, primaryKey: true },
          firstName: { type: S.STRING(60), allowNull: false },
          lastName: { type: S.STRING(60), allowNull: false },
          email: { type: S.STRING(254), allowNull: true },
          phone: { type: S.STRING(30), allowNull: true },
          userId: {
            type: S.UUID,
            allowNull: true,
            unique: true,
            references: { model: "users", key: "id" },
            onDelete: "RESTRICT"
          },
          dpi: { type: S.STRING(13), allowNull: true },
          birthDate: { type: S.DATEONLY, allowNull: true },
          address: { type: S.STRING(500), allowNull: true },
          enabled: { type: S.BOOLEAN, allowNull: false, defaultValue: true },
          createdAt: { type: S.DATE, allowNull: false },
          updatedAt: { type: S.DATE, allowNull: false }
        },
        { transaction }
      );
      await q.addIndex("patients", ["email"], { transaction });
      await q.addIndex("patients", ["dpi"], { unique: true, transaction });
      await q.createTable(
        "patient_clinics",
        {
          patientId: {
            type: S.UUID,
            primaryKey: true,
            references: { model: "patients", key: "id" },
            onDelete: "RESTRICT"
          },
          clinicId: {
            type: S.UUID,
            primaryKey: true,
            references: { model: "clinics", key: "id" },
            onDelete: "RESTRICT"
          },
          createdAt: { type: S.DATE, allowNull: false }
        },
        { transaction }
      );
      await q.addIndex("patient_clinics", ["clinicId", "patientId"], { transaction });
      await q.addColumn(
        "invitations",
        "patientId",
        {
          type: S.UUID,
          allowNull: true,
          references: { model: "patients", key: "id" },
          onDelete: "RESTRICT"
        },
        { transaction }
      );
      await q.addIndex("invitations", ["patientId"], { transaction });
    });
  },
  async down(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      await q.removeColumn("invitations", "patientId", { transaction });
      await q.dropTable("patient_clinics", { transaction });
      await q.dropTable("patients", { transaction });
      await q.dropTable("clinic_staff", { transaction });
      await q.dropTable("clinics", { transaction });
    });
  }
};
