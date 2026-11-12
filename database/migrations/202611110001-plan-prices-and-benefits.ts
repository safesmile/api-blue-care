import type { QueryInterface } from "sequelize";

export = {
  async up(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      await q.sequelize.query(
        `ALTER TABLE plan_versions DROP CONSTRAINT plan_version_price_check,
          ADD CONSTRAINT plan_version_price_check CHECK (
            "monthlyPriceCents" BETWEEN 500 AND 100000000
            AND "annualPriceCents" BETWEEN 500 AND 1000000000 AND currency='GTQ');
        ALTER TABLE benefit_definitions ALTER COLUMN "planId" DROP NOT NULL;
        CREATE UNIQUE INDEX benefit_catalog_code ON benefit_definitions (code) WHERE "planId" IS NULL;
        CREATE TABLE plan_benefits (
          "planId" UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
          "benefitId" UUID NOT NULL REFERENCES benefit_definitions(id) ON DELETE RESTRICT,
          PRIMARY KEY ("planId","benefitId")
        );
        CREATE INDEX plan_benefits_by_benefit ON plan_benefits ("benefitId","planId");
        INSERT INTO plan_benefits ("planId","benefitId") SELECT "planId",id FROM benefit_definitions;`,
        { transaction }
      );
    });
  },
  async down(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      await q.sequelize.query(
        `DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM benefit_definitions b
            WHERE NOT EXISTS (SELECT 1 FROM plan_benefits pb WHERE pb."benefitId"=b.id AND pb."planId"=b."planId")
          ) OR EXISTS (
            SELECT 1 FROM plan_benefits pb JOIN benefit_definitions b ON b.id=pb."benefitId"
            WHERE pb."planId" IS DISTINCT FROM b."planId"
          ) THEN RAISE EXCEPTION 'Cannot roll back existing plan benefit changes'; END IF;
        END $$;
        ALTER TABLE plan_versions DROP CONSTRAINT plan_version_price_check,
          ADD CONSTRAINT plan_version_price_check CHECK (
            "monthlyPriceCents" BETWEEN 500 AND 100000000
            AND "annualPriceCents"="monthlyPriceCents"*10 AND currency='GTQ');
        ALTER TABLE benefit_definitions ALTER COLUMN "planId" SET NOT NULL;
        DROP INDEX benefit_catalog_code;
        DROP TABLE plan_benefits;`,
        { transaction }
      );
    });
  }
};
