import type { QueryInterface } from "sequelize";
import type * as SequelizeTypes from "sequelize";
export = {
  async up(q: QueryInterface, S: typeof SequelizeTypes) {
    await q.sequelize.transaction(async transaction => {
      await q.createTable(
        "plans",
        {
          id: { type: S.UUID, primaryKey: true },
          code: { type: S.STRING(60), allowNull: false, unique: true },
          enabled: { type: S.BOOLEAN, allowNull: false, defaultValue: true },
          currentVersionId: { type: S.UUID },
          createdAt: { type: S.DATE, allowNull: false },
          updatedAt: { type: S.DATE, allowNull: false }
        },
        { transaction }
      );
      await q.createTable(
        "plan_versions",
        {
          id: { type: S.UUID, primaryKey: true },
          planId: { type: S.UUID, allowNull: false, references: { model: "plans", key: "id" }, onDelete: "RESTRICT" },
          number: { type: S.INTEGER, allowNull: false },
          name: { type: S.STRING(120), allowNull: false },
          description: { type: S.STRING(2000), allowNull: false },
          benefitDescriptions: { type: S.JSONB, allowNull: false },
          monthlyPriceCents: { type: S.INTEGER, allowNull: false },
          annualPriceCents: { type: S.INTEGER, allowNull: false },
          currency: { type: S.STRING(3), allowNull: false, defaultValue: "GTQ" },
          taxDisclosure: { type: S.STRING(1000), allowNull: false },
          createdAt: { type: S.DATE, allowNull: false },
          publishedAt: { type: S.DATE }
        },
        { transaction }
      );
      await q.addIndex("plan_versions", ["planId", "number"], { unique: true, transaction });
      await q.sequelize.query(
        `ALTER TABLE plan_versions ADD CONSTRAINT plan_version_price_check
        CHECK ("monthlyPriceCents" >= 500 AND "monthlyPriceCents" <= 100000000 AND "annualPriceCents" = "monthlyPriceCents" * 10 AND currency = 'GTQ')`,
        { transaction }
      );
      await q.addConstraint("plans", {
        fields: ["currentVersionId"],
        type: "foreign key",
        name: "plans_current_version_fk",
        references: { table: "plan_versions", field: "id" },
        onDelete: "RESTRICT",
        onUpdate: "RESTRICT",
        transaction
      });
      await q.createTable(
        "memberships",
        {
          id: { type: S.UUID, primaryKey: true },
          patientId: {
            type: S.UUID,
            allowNull: false,
            references: { model: "patients", key: "id" },
            onDelete: "RESTRICT"
          },
          planVersionId: {
            type: S.UUID,
            allowNull: false,
            references: { model: "plan_versions", key: "id" },
            onDelete: "RESTRICT"
          },
          cadence: { type: S.STRING(10), allowNull: false },
          amountCents: { type: S.INTEGER, allowNull: false },
          currency: { type: S.STRING(3), allowNull: false },
          createdAt: { type: S.DATE, allowNull: false },
          anchorAt: { type: S.DATE },
          periodStart: { type: S.DATE },
          paidThrough: { type: S.DATE },
          periodsCount: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
          suspendedAt: { type: S.DATE },
          cancelRequestedAt: { type: S.DATE },
          stoppedAt: { type: S.DATE },
          closedAt: { type: S.DATE },
          subscriptionId: { type: S.STRING(100), unique: true },
          checkoutId: { type: S.STRING(100), unique: true },
          checkoutUrl: { type: S.STRING(1000) },
          checkoutStatus: { type: S.STRING(20), allowNull: false, defaultValue: "none" },
          checkoutStartedAt: { type: S.DATE },
          checkoutExpiresAt: { type: S.DATE }
        },
        { transaction }
      );
      await q.sequelize.query(
        'CREATE UNIQUE INDEX memberships_one_open_patient ON memberships ("patientId") WHERE "closedAt" IS NULL',
        { transaction }
      );
      await q.addIndex("memberships", ["patientId", "createdAt"], { transaction });
      await q.sequelize.query(
        `ALTER TABLE memberships ADD CONSTRAINT membership_contract_check
        CHECK (cadence IN ('monthly','annual') AND currency='GTQ' AND "amountCents">0 AND "periodsCount">=0
        AND (("anchorAt" IS NULL AND "periodStart" IS NULL AND "paidThrough" IS NULL AND "periodsCount"=0)
        OR ("anchorAt" IS NOT NULL AND "periodStart" IS NOT NULL AND "paidThrough">"periodStart" AND "periodsCount">0)))`,
        { transaction }
      );
      await q.createTable(
        "membership_periods",
        {
          id: { type: S.UUID, primaryKey: true },
          membershipId: {
            type: S.UUID,
            allowNull: false,
            references: { model: "memberships", key: "id" },
            onDelete: "RESTRICT"
          },
          paymentId: { type: S.STRING(100), allowNull: false, unique: true },
          number: { type: S.INTEGER, allowNull: false },
          amountCents: { type: S.INTEGER, allowNull: false },
          currency: { type: S.STRING(3), allowNull: false },
          paidAt: { type: S.DATE, allowNull: false },
          startsAt: { type: S.DATE, allowNull: false },
          endsAt: { type: S.DATE, allowNull: false },
          recordedAt: { type: S.DATE, allowNull: false }
        },
        { transaction }
      );
      await q.addIndex("membership_periods", ["membershipId", "number"], { unique: true, transaction });
      await q.sequelize.query(
        'ALTER TABLE membership_periods ADD CONSTRAINT membership_period_range CHECK ("endsAt">"startsAt" AND "amountCents">0)',
        { transaction }
      );
      await q.createTable(
        "membership_billing_jobs",
        {
          id: { type: S.UUID, primaryKey: true },
          membershipId: {
            type: S.UUID,
            allowNull: false,
            references: { model: "memberships", key: "id" },
            onDelete: "RESTRICT"
          },
          kind: { type: S.STRING(10), allowNull: false },
          status: { type: S.STRING(20), allowNull: false, defaultValue: "pending" },
          attempts: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
          nextAttemptAt: { type: S.DATE, allowNull: false },
          lease: { type: S.UUID },
          leaseUntil: { type: S.DATE },
          errorCode: { type: S.STRING(60) }
        },
        { transaction }
      );
      await q.addIndex("membership_billing_jobs", ["membershipId", "kind"], { unique: true, transaction });
      await q.createTable(
        "recurrente_events",
        {
          id: { type: S.STRING(150), primaryKey: true },
          eventType: { type: S.STRING(100), allowNull: false },
          resourceId: { type: S.STRING(100), allowNull: false },
          membershipId: { type: S.UUID, references: { model: "memberships", key: "id" }, onDelete: "RESTRICT" },
          status: { type: S.STRING(20), allowNull: false, defaultValue: "pending" },
          attempts: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
          receivedAt: { type: S.DATE, allowNull: false },
          nextAttemptAt: { type: S.DATE, allowNull: false },
          lease: { type: S.UUID },
          leaseUntil: { type: S.DATE },
          errorCode: { type: S.STRING(60) }
        },
        { transaction }
      );
      for (const table of ["recurrente_events", "membership_billing_jobs"])
        await q.addIndex(table, ["status", "nextAttemptAt"], { transaction });
      await q.sequelize.query(
        `CREATE FUNCTION blue_care_immutable_history() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
        IF TG_OP='UPDATE' AND TG_TABLE_NAME='plan_versions' AND OLD."publishedAt" IS NULL AND NEW."publishedAt" IS NOT NULL
        AND (TO_JSONB(OLD)-'publishedAt')=(TO_JSONB(NEW)-'publishedAt') THEN RETURN NEW; END IF;
        RAISE EXCEPTION 'Commercial history is immutable'; END; $$`,
        { transaction }
      );
      for (const table of ["plan_versions", "membership_periods"])
        await q.sequelize.query(
          `CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION blue_care_immutable_history()`,
          { transaction }
        );
      for (const table of ["plan_versions", "membership_periods"])
        await q.sequelize.query(
          `CREATE TRIGGER ${table}_no_truncate BEFORE TRUNCATE ON ${table}
          FOR EACH STATEMENT EXECUTE FUNCTION blue_care_immutable_history()`,
          { transaction }
        );
      await q.sequelize.query(
        `CREATE FUNCTION blue_care_contract_immutable() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
        IF ROW(OLD."patientId",OLD."planVersionId",OLD.cadence,OLD."amountCents",OLD.currency)
        IS DISTINCT FROM ROW(NEW."patientId",NEW."planVersionId",NEW.cadence,NEW."amountCents",NEW.currency)
        THEN RAISE EXCEPTION 'Contracted patient, plan and price are immutable'; END IF; RETURN NEW; END; $$`,
        { transaction }
      );
      await q.sequelize.query(
        "CREATE TRIGGER memberships_contract_immutable BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION blue_care_contract_immutable()",
        { transaction }
      );
    });
  },
  async down(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      for (const table of ["recurrente_events", "membership_billing_jobs", "membership_periods", "memberships"])
        await q.dropTable(table, { transaction });
      await q.removeConstraint("plans", "plans_current_version_fk", { transaction });
      await q.dropTable("plan_versions", { transaction });
      await q.dropTable("plans", { transaction });
      await q.sequelize.query("DROP FUNCTION blue_care_immutable_history()", { transaction });
      await q.sequelize.query("DROP FUNCTION blue_care_contract_immutable()", { transaction });
    });
  }
};
