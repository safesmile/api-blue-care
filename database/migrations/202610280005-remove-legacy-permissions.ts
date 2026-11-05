import type { QueryInterface } from "sequelize";
import * as SequelizeTypes from "sequelize";
export = {
  async up(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      for (const table of ["users", "account_actions"]) {
        const columns = await q.describeTable(table, { logging: false, ...{ transaction } });
        if (!columns.permissions) continue;
        // Preserve historical access through the explicit synchronization tool before removing its old storage.
        const rows = await q.sequelize.query<{ hasGrants: boolean }>(
          'SELECT EXISTS (SELECT 1 FROM "' + table + '" WHERE cardinality(permissions) > 0) AS "hasGrants"',
          { transaction, type: SequelizeTypes.QueryTypes.SELECT }
        );
        if (rows[0].hasGrants)
          throw new Error("Run npm run permissions before migrating: historical grants still exist in " + table);
      }
      for (const table of ["users", "account_actions"]) {
        const columns = await q.describeTable(table, { logging: false, ...{ transaction } });
        if (columns.permissions) await q.removeColumn(table, "permissions", { transaction });
      }
    });
  },
  async down(q: QueryInterface, S: typeof SequelizeTypes) {
    await q.sequelize.transaction(async transaction => {
      for (const table of ["users", "account_actions"]) {
        const columns = await q.describeTable(table, { logging: false, ...{ transaction } });
        if (!columns.permissions)
          await q.addColumn(
            table,
            "permissions",
            { type: S.ARRAY(S.STRING), allowNull: false, defaultValue: [] },
            { transaction }
          );
      }
    });
  }
};
