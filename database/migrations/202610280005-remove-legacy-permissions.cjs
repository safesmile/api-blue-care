module.exports = {
  async up(q) {
    await q.sequelize.transaction(async transaction => {
      for (const table of ["users", "account_actions"]) {
        const columns = await q.describeTable(table, { transaction });
        if (!columns.permissions) continue;
        // Preserve historical access through the explicit synchronization tool before removing its old storage.
        const [rows] = await q.sequelize.query(
          'SELECT EXISTS (SELECT 1 FROM "' + table + '" WHERE cardinality(permissions) > 0) AS "hasGrants"',
          { transaction }
        );
        if (rows[0].hasGrants)
          throw new Error("Run npm run permissions before migrating: historical grants still exist in " + table);
      }
      for (const table of ["users", "account_actions"]) {
        const columns = await q.describeTable(table, { transaction });
        if (columns.permissions) await q.removeColumn(table, "permissions", { transaction });
      }
    });
  },
  async down(q, S) {
    await q.sequelize.transaction(async transaction => {
      for (const table of ["users", "account_actions"]) {
        const columns = await q.describeTable(table, { transaction });
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
