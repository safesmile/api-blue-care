import type { QueryInterface } from "sequelize";

export = {
  async up(q: QueryInterface) {
    await q.sequelize.query('ALTER TABLE plan_versions ADD COLUMN "benefitIds" UUID[]');
  },
  async down(q: QueryInterface) {
    await q.sequelize.query('ALTER TABLE plan_versions DROP COLUMN "benefitIds"');
  }
};
