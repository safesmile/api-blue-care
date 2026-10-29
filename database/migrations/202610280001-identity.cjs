"use strict";
module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      const timestamps = {
        createdAt: { type: S.DATE, allowNull: false },
        updatedAt: { type: S.DATE, allowNull: false }
      };
      await q.createTable(
        "users",
        {
          id: { type: S.UUID, primaryKey: true },
          email: { type: S.STRING(254), allowNull: false, unique: true },
          name: { type: S.STRING(120), allowNull: false },
          passwordHash: { type: S.STRING, allowNull: false },
          enabled: { type: S.BOOLEAN, allowNull: false },
          permissions: { type: S.ARRAY(S.STRING), allowNull: false },
          ...timestamps
        },
        { transaction }
      );
      await q.createTable(
        "sessions",
        {
          id: { type: S.UUID, primaryKey: true },
          userId: { type: S.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
          tokenHash: { type: S.STRING(64), unique: true, allowNull: false },
          expiresAt: { type: S.DATE, allowNull: false },
          absoluteExpiresAt: { type: S.DATE, allowNull: false },
          revoked: { type: S.BOOLEAN, allowNull: false },
          ...timestamps
        },
        { transaction }
      );
      await q.addIndex("sessions", ["userId"], { transaction });
      await q.addIndex("sessions", ["expiresAt"], { transaction });
    });
  },
  async down(q) {
    await q.sequelize.transaction(async transaction => {
      await q.dropTable("sessions", { transaction });
      await q.dropTable("users", { transaction });
    });
  }
};
