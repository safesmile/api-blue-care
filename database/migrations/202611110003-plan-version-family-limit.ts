import type { QueryInterface } from "sequelize";

export = {
  async up(q: QueryInterface) {
    await q.sequelize.query(
      'ALTER TABLE plan_versions ADD COLUMN "maxBeneficiaries" INTEGER CHECK ("maxBeneficiaries" BETWEEN 0 AND 100)'
    );
  },
  async down(q: QueryInterface) {
    await q.sequelize.query('ALTER TABLE plan_versions DROP COLUMN "maxBeneficiaries"');
  }
};
