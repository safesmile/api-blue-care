import type { QueryInterface } from "sequelize";
import type * as SequelizeTypes from "sequelize";
export = {
  async up(q: QueryInterface, S: typeof SequelizeTypes) {
    await q.sequelize.transaction(async transaction => {
      await q.createTable(
        "notifications",
        {
          id: { type: S.UUID, primaryKey: true },
          userId: { type: S.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
          eventKey: { type: S.STRING(200), allowNull: false },
          title: { type: S.STRING(200), allowNull: false },
          body: { type: S.TEXT, allowNull: false },
          createdAt: { type: S.DATE, allowNull: false },
          visibleAt: { type: S.DATE, allowNull: false },
          readAt: { type: S.DATE },
          cancelledAt: { type: S.DATE }
        },
        { transaction }
      );
      await q.addIndex("notifications", ["userId", "eventKey"], { unique: true, transaction });
      await q.addIndex("notifications", ["userId", "createdAt"], { transaction });
      await q.createTable(
        "notification_deliveries",
        {
          id: { type: S.UUID, primaryKey: true },
          notificationId: {
            type: S.UUID,
            allowNull: false,
            unique: true,
            references: { model: "notifications", key: "id" },
            onDelete: "CASCADE"
          },
          email: { type: S.STRING(254), allowNull: false },
          status: { type: S.STRING(20), allowNull: false },
          attempts: { type: S.INTEGER, allowNull: false },
          nextAttemptAt: { type: S.DATE, allowNull: false },
          lease: { type: S.UUID },
          leasedUntil: { type: S.DATE },
          lastAttemptAt: { type: S.DATE },
          lastError: { type: S.STRING(100) }
        },
        { transaction }
      );
      await q.addIndex("notification_deliveries", ["status", "nextAttemptAt"], { transaction });
    });
  },
  async down(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      await q.dropTable("notification_deliveries", { transaction });
      await q.dropTable("notifications", { transaction });
    });
  }
};
