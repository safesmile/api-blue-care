import type { QueryInterface } from "sequelize";
import type * as SequelizeTypes from "sequelize";
export = {
  async up(q: QueryInterface, S: typeof SequelizeTypes) {
    await q.sequelize.transaction(async transaction => {
      const ref = (model: string) => ({
        type: S.UUID,
        allowNull: false,
        references: { model, key: "id" },
        onDelete: "RESTRICT"
      });
      await q.createTable(
        "benefit_definitions",
        {
          id: { type: S.UUID, primaryKey: true },
          planId: ref("plans"),
          code: { type: S.STRING(60), allowNull: false },
          kind: { type: S.STRING(12), allowNull: false },
          period: { type: S.STRING(12), allowNull: false },
          audience: { type: S.STRING(15), allowNull: false },
          currentVersionId: { type: S.UUID },
          createdAt: { type: S.DATE, allowNull: false }
        },
        { transaction }
      );
      await q.addIndex("benefit_definitions", ["planId", "code"], { unique: true, transaction });
      await q.sequelize.query(
        `ALTER TABLE benefit_definitions ADD CONSTRAINT benefit_definition_types CHECK
        (kind IN ('discount','service','item') AND period IN ('monthly','annual','contract') AND audience IN ('holder','beneficiaries','all'))`,
        { transaction }
      );
      await q.createTable(
        "benefit_versions",
        {
          id: { type: S.UUID, primaryKey: true },
          benefitId: ref("benefit_definitions"),
          number: { type: S.INTEGER, allowNull: false },
          name: { type: S.STRING(120), allowNull: false },
          description: { type: S.STRING(1500), allowNull: false },
          limitUnits: { type: S.INTEGER, allowNull: false },
          discountBasisPoints: { type: S.INTEGER },
          enabled: { type: S.BOOLEAN, allowNull: false },
          createdAt: { type: S.DATE, allowNull: false },
          publishedAt: { type: S.DATE }
        },
        { transaction }
      );
      await q.addIndex("benefit_versions", ["benefitId", "number"], { unique: true, transaction });
      await q.sequelize.query(
        'ALTER TABLE benefit_versions ADD CONSTRAINT benefit_limits CHECK ("limitUnits" BETWEEN 1 AND 100000 AND ("discountBasisPoints" IS NULL OR "discountBasisPoints" BETWEEN 1 AND 10000))',
        { transaction }
      );
      await q.addConstraint("benefit_definitions", {
        fields: ["currentVersionId"],
        name: "benefits_current_version_fk",
        type: "foreign key",
        references: { table: "benefit_versions", field: "id" },
        onDelete: "RESTRICT",
        onUpdate: "RESTRICT",
        transaction
      });
      await q.createTable(
        "plan_family_settings",
        {
          planId: { ...ref("plans"), primaryKey: true },
          maxBeneficiaries: { type: S.INTEGER, allowNull: false },
          updatedAt: { type: S.DATE, allowNull: false }
        },
        { transaction }
      );
      await q.sequelize.query(
        'ALTER TABLE plan_family_settings ADD CONSTRAINT family_limit CHECK ("maxBeneficiaries" BETWEEN 0 AND 100)',
        { transaction }
      );
      await q.createTable(
        "beneficiary_slots",
        {
          id: { type: S.UUID, primaryKey: true },
          patientId: ref("patients"),
          number: { type: S.INTEGER, allowNull: false },
          currentBeneficiaryId: { type: S.UUID },
          lockedUntil: { type: S.DATE, allowNull: false },
          createdAt: { type: S.DATE, allowNull: false }
        },
        { transaction }
      );
      await q.addIndex("beneficiary_slots", ["patientId", "number"], { unique: true, transaction });
      await q.createTable(
        "beneficiaries",
        {
          id: { type: S.UUID, primaryKey: true },
          slotId: ref("beneficiary_slots"),
          firstName: { type: S.STRING(60), allowNull: false },
          lastName: { type: S.STRING(60), allowNull: false },
          birthDate: { type: S.DATEONLY },
          createdAt: { type: S.DATE, allowNull: false }
        },
        { transaction }
      );
      await q.addConstraint("beneficiary_slots", {
        fields: ["currentBeneficiaryId"],
        name: "slots_current_beneficiary_fk",
        type: "foreign key",
        references: { table: "beneficiaries", field: "id" },
        onDelete: "RESTRICT",
        onUpdate: "RESTRICT",
        transaction
      });
      await q.createTable(
        "benefit_tickets",
        {
          id: { type: S.UUID, primaryKey: true },
          membershipId: ref("memberships"),
          benefitId: ref("benefit_definitions"),
          beneficiaryId: { type: S.UUID, references: { model: "beneficiaries", key: "id" }, onDelete: "RESTRICT" },
          tokenHash: { type: S.STRING(64), allowNull: false, unique: true },
          units: { type: S.INTEGER, allowNull: false },
          createdAt: { type: S.DATE, allowNull: false },
          expiresAt: { type: S.DATE, allowNull: false },
          consumedAt: { type: S.DATE }
        },
        { transaction }
      );
      await q.createTable(
        "benefit_consumptions",
        {
          id: { type: S.UUID, primaryKey: true },
          membershipId: ref("memberships"),
          benefitId: ref("benefit_definitions"),
          benefitVersionId: ref("benefit_versions"),
          beneficiaryId: { type: S.UUID, references: { model: "beneficiaries", key: "id" }, onDelete: "RESTRICT" },
          recipientKey: { type: S.UUID, allowNull: false },
          recipientName: { type: S.STRING(120), allowNull: false },
          clinicId: ref("clinics"),
          clinicName: { type: S.STRING(120), allowNull: false },
          performedBy: { type: S.UUID, allowNull: false },
          actorName: { type: S.STRING(120), allowNull: false },
          units: { type: S.INTEGER, allowNull: false },
          limitSnapshot: { type: S.INTEGER, allowNull: false },
          discountBasisPoints: { type: S.INTEGER },
          windowStart: { type: S.DATE, allowNull: false },
          windowEnd: { type: S.DATE },
          occurredAt: { type: S.DATE, allowNull: false },
          serviceReference: { type: S.STRING(120), allowNull: false },
          idempotencyKey: { type: S.UUID, allowNull: false, unique: true },
          ticketId: {
            type: S.UUID,
            unique: true,
            references: { model: "benefit_tickets", key: "id" },
            onDelete: "RESTRICT"
          }
        },
        { transaction }
      );
      await q.addIndex("benefit_consumptions", ["membershipId", "benefitId", "recipientKey", "windowStart"], {
        transaction
      });
      await q.addIndex("benefit_consumptions", ["clinicId", "occurredAt", "id"], { transaction });
      await q.sequelize.query(
        'ALTER TABLE benefit_consumptions ADD CONSTRAINT consumption_units CHECK (units>0 AND "limitSnapshot">0 AND ("windowEnd" IS NULL OR "windowEnd">"windowStart"))',
        { transaction }
      );
      await q.createTable(
        "benefit_reversals",
        {
          id: { type: S.UUID, primaryKey: true },
          consumptionId: { ...ref("benefit_consumptions"), unique: true },
          performedBy: { type: S.UUID, allowNull: false },
          actorName: { type: S.STRING(120), allowNull: false },
          reason: { type: S.STRING(500), allowNull: false },
          occurredAt: { type: S.DATE, allowNull: false },
          idempotencyKey: { type: S.UUID, allowNull: false, unique: true }
        },
        { transaction }
      );
      await q.createTable(
        "benefit_service_claims",
        {
          membershipId: { ...ref("memberships"), primaryKey: true },
          benefitId: { ...ref("benefit_definitions"), primaryKey: true },
          recipientKey: { type: S.UUID, primaryKey: true },
          clinicId: { ...ref("clinics"), primaryKey: true },
          serviceReference: { type: S.STRING(120), primaryKey: true },
          consumptionId: { ...ref("benefit_consumptions"), unique: true }
        },
        { transaction }
      );
      await q.sequelize.query(
        `CREATE FUNCTION blue_care_benefit_history() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
        IF TG_OP='UPDATE' AND TG_TABLE_NAME='benefit_versions' AND OLD."publishedAt" IS NULL AND NEW."publishedAt" IS NOT NULL
        AND (TO_JSONB(OLD)-'publishedAt')=(TO_JSONB(NEW)-'publishedAt') THEN RETURN NEW; END IF;
        RAISE EXCEPTION 'Benefit history is immutable'; END; $$`,
        { transaction }
      );
      for (const table of ["benefit_versions", "beneficiaries", "benefit_consumptions", "benefit_reversals"]) {
        await q.sequelize.query(
          `CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION blue_care_benefit_history()`,
          { transaction }
        );
        await q.sequelize.query(
          `CREATE TRIGGER ${table}_no_truncate BEFORE TRUNCATE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION blue_care_benefit_history()`,
          { transaction }
        );
      }
      await q.sequelize.query(
        `CREATE FUNCTION blue_care_benefit_identity() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
        IF ROW(OLD."planId",OLD.code,OLD.kind,OLD.period,OLD.audience) IS DISTINCT FROM ROW(NEW."planId",NEW.code,NEW.kind,NEW.period,NEW.audience)
        THEN RAISE EXCEPTION 'Benefit identity and quota dimensions are immutable'; END IF; RETURN NEW; END; $$`,
        { transaction }
      );
      await q.sequelize.query(
        "CREATE TRIGGER benefit_identity_immutable BEFORE UPDATE ON benefit_definitions FOR EACH ROW EXECUTE FUNCTION blue_care_benefit_identity()",
        { transaction }
      );
    });
  },
  async down(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      for (const table of ["benefit_service_claims", "benefit_reversals", "benefit_consumptions", "benefit_tickets"])
        await q.dropTable(table, { transaction });
      await q.removeConstraint("beneficiary_slots", "slots_current_beneficiary_fk", { transaction });
      for (const table of ["beneficiaries", "beneficiary_slots", "plan_family_settings"])
        await q.dropTable(table, { transaction });
      await q.removeConstraint("benefit_definitions", "benefits_current_version_fk", { transaction });
      await q.dropTable("benefit_versions", { transaction });
      await q.dropTable("benefit_definitions", { transaction });
      await q.sequelize.query("DROP FUNCTION blue_care_benefit_history()", { transaction });
      await q.sequelize.query("DROP FUNCTION blue_care_benefit_identity()", { transaction });
    });
  }
};
