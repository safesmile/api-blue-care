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
      await q.addConstraint("user_roles", {
        fields: ["clinicId"],
        type: "foreign key",
        name: "user_roles_clinic_fk",
        references: { table: "clinics", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
        transaction
      });
      await q.addConstraint("sessions", {
        fields: ["clinicId"],
        type: "foreign key",
        name: "sessions_clinic_fk",
        references: { table: "clinics", field: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
        transaction
      });
      await q.addColumn(
        "invitations",
        "clinicAssignments",
        { type: S.JSONB, allowNull: false, defaultValue: [] },
        { transaction }
      );
      await q.addColumn(
        "invitations",
        "kind",
        { type: S.STRING(20), allowNull: false, defaultValue: "general" },
        { transaction }
      );
      await q.sequelize.query(
        "ALTER TABLE invitations ADD CONSTRAINT invitations_kind_check CHECK (kind IN ('general','patient','collaborator'))",
        { transaction }
      );
      await q.addColumn(
        "invitations",
        "staff",
        { type: S.BOOLEAN, allowNull: false, defaultValue: false },
        { transaction }
      );
      await q.createTable(
        "staff_profiles",
        {
          userId: { type: S.UUID, primaryKey: true, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
          createdAt: { type: S.DATE, allowNull: false }
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
      await q.sequelize.query(
        `CREATE FUNCTION blue_care_clinic_allowed(actor UUID, clinic UUID, selected UUID, operation TEXT)
        RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$ SELECT
        (selected IS NULL OR selected=clinic) AND EXISTS(SELECT 1 FROM clinic_staff s WHERE s."userId"=actor AND s."clinicId"=clinic)
        AND (operation IS NULL OR EXISTS(SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp."roleId"=ur."roleId"
        WHERE ur."userId"=actor AND (ur."clinicId" IS NULL OR ur."clinicId"=clinic) AND rp."permissionCode"=operation)) $$`,
        { transaction }
      );
    });
  },
  async down(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      await q.removeColumn("invitations", "patientId", { transaction });
      await q.dropTable("patient_clinics", { transaction });
      await q.dropTable("patients", { transaction });
      await q.dropTable("clinic_staff", { transaction });
      await q.sequelize.query("DROP TABLE IF EXISTS staff_profiles", { transaction });
      await q.sequelize.query('ALTER TABLE invitations DROP COLUMN IF EXISTS "staff"', { transaction });
      await q.sequelize.query('ALTER TABLE invitations DROP COLUMN IF EXISTS "kind"', { transaction });
      await q.sequelize.query("ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_clinic_fk", { transaction });
      await q.sequelize.query("ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_clinic_fk", { transaction });
      await q.sequelize.query('ALTER TABLE invitations DROP COLUMN IF EXISTS "clinicAssignments"', { transaction });
      await q.sequelize.query("DROP FUNCTION IF EXISTS blue_care_clinic_allowed(UUID,UUID,UUID,TEXT)", { transaction });
      await q.dropTable("clinics", { transaction });
    });
  }
};
