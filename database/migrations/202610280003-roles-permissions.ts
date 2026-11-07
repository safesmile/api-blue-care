import type { QueryInterface } from "sequelize";
import type * as SequelizeTypes from "sequelize";
export = {
  async up(q: QueryInterface, S: typeof SequelizeTypes) {
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
          id: { type: S.UUID, primaryKey: true, defaultValue: S.literal("gen_random_uuid()") },
          userId: { type: S.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
          roleId: { type: S.UUID, allowNull: false, references: { model: "roles", key: "id" }, onDelete: "CASCADE" },
          clinicId: { type: S.UUID, allowNull: true }
        },
        { transaction }
      );
      await q.addIndex("user_roles", ["roleId"], { transaction });
      await q.sequelize.query(
        'CREATE UNIQUE INDEX user_roles_scope ON user_roles ("userId","roleId","clinicId") NULLS NOT DISTINCT',
        { transaction }
      );
    });
  },
  async down(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      for (const table of ["user_roles", "role_permissions", "roles", "permissions"])
        await q.dropTable(table, { transaction });
    });
  }
};
