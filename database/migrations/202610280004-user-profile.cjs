module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      const users = await q.describeTable("users", { transaction });
      // Historical users retain their existing authentication behavior.
      for (const name of ["firstName", "lastName"])
        if (!users[name])
          await q.addColumn("users", name, { type: S.STRING(60), allowNull: false, defaultValue: "" }, { transaction });
      if (!users.verified)
        await q.addColumn(
          "users",
          "verified",
          { type: S.BOOLEAN, allowNull: false, defaultValue: true },
          { transaction }
        );
      // Keep historical grant columns until the explicit permissions sync can preserve them.
      if (users.permissions)
        await q.changeColumn(
          "users",
          "permissions",
          { type: S.ARRAY(S.STRING), allowNull: false, defaultValue: [] },
          { transaction }
        );
      const actions = await q.describeTable("account_actions", { transaction });
      if (!actions.roles)
        await q.addColumn(
          "account_actions",
          "roles",
          { type: S.ARRAY(S.STRING), allowNull: false, defaultValue: [] },
          { transaction }
        );
      if (actions.permissions)
        await q.changeColumn(
          "account_actions",
          "permissions",
          { type: S.ARRAY(S.STRING), allowNull: false, defaultValue: [] },
          { transaction }
        );
    });
  },
  async down(q) {
    await q.sequelize.transaction(async transaction => {
      for (const name of ["firstName", "lastName", "verified"]) await q.removeColumn("users", name, { transaction });
      // roles may predate this migration in installations that used the initial development schema.
    });
  }
};
