module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      await q.createTable(
        "permissions",
        {
          shortcode: { type: S.STRING, primaryKey: true },
          scope: { type: S.STRING, allowNull: false, unique: true },
          description: { type: S.STRING, allowNull: false },
          group: { type: S.STRING, allowNull: false }
        },
        { transaction }
      );
      await q.createTable(
        "roles",
        {
          id: { type: S.UUID, primaryKey: true },
          name: { type: S.STRING, unique: true, allowNull: false },
          description: { type: S.STRING, allowNull: false },
          isProtected: { type: S.BOOLEAN, allowNull: false }
        },
        { transaction }
      );
      await q.createTable(
        "role_permissions",
        {
          roleId: { type: S.UUID, primaryKey: true, references: { model: "roles", key: "id" }, onDelete: "CASCADE" },
          permissionCode: {
            type: S.STRING,
            primaryKey: true,
            references: { model: "permissions", key: "shortcode" },
            onDelete: "CASCADE"
          }
        },
        { transaction }
      );
      await q.createTable(
        "user_roles",
        {
          userId: { type: S.UUID, primaryKey: true, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
          roleId: { type: S.UUID, primaryKey: true, references: { model: "roles", key: "id" }, onDelete: "CASCADE" }
        },
        { transaction }
      );
      await q.addIndex("user_roles", ["roleId"], { transaction });
    });
  },
  async down(q) {
    await q.sequelize.transaction(async transaction => {
      for (const table of ["user_roles", "role_permissions", "roles", "permissions"])
        await q.dropTable(table, { transaction });
    });
  }
};
