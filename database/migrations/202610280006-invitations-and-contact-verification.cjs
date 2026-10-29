const { randomUUID } = require("node:crypto");
module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      await q.createTable(
        "invitations",
        {
          id: { type: S.UUID, primaryKey: true },
          email: { type: S.STRING(254), allowNull: false },
          firstName: { type: S.STRING(60), allowNull: false },
          lastName: { type: S.STRING(60), allowNull: false },
          roles: { type: S.ARRAY(S.STRING), allowNull: false },
          tokenHash: { type: S.STRING(64), unique: true, allowNull: false },
          invitedBy: { type: S.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
          invitedByName: { type: S.STRING(120), allowNull: false },
          invitedByEmail: { type: S.STRING(254), allowNull: false },
          status: { type: S.STRING, allowNull: false },
          createdAt: { type: S.DATE, allowNull: false },
          expiresAt: { type: S.DATE, allowNull: false },
          acceptedAt: { type: S.DATE, allowNull: true },
          acceptedUserId: {
            type: S.UUID,
            allowNull: true,
            references: { model: "users", key: "id" },
            onDelete: "SET NULL"
          },
          lastSendAttemptAt: { type: S.DATE, allowNull: true },
          lastSentAt: { type: S.DATE, allowNull: true },
          deliveryStatus: { type: S.STRING, allowNull: false }
        },
        { transaction }
      );
      await q.addIndex("invitations", ["email", "status"], { transaction });
      await q.addIndex("invitations", ["createdAt", "id"], { transaction });
      await q.addColumn(
        "account_actions",
        "userId",
        { type: S.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
        { transaction }
      );
      await q.addColumn("account_actions", "targetEmail", { type: S.STRING(254), allowNull: true }, { transaction });
      // Preserve pending invitation credentials while moving them out of generic action tokens.
      const [rows] = await q.sequelize.query("SELECT * FROM account_actions WHERE kind = 'invite'", { transaction });
      for (const row of rows)
        await q.bulkInsert(
          "invitations",
          [
            {
              id: randomUUID(),
              email: row.email,
              firstName: row.name.slice(0, 60),
              lastName: "",
              roles: row.roles,
              tokenHash: row.hash,
              invitedBy: null,
              invitedByName: "",
              invitedByEmail: "",
              status: "pending",
              createdAt: row.createdAt,
              expiresAt: row.expiresAt,
              acceptedAt: null,
              acceptedUserId: null,
              lastSendAttemptAt: null,
              lastSentAt: null,
              deliveryStatus: "sent"
            }
          ],
          { transaction }
        );
      await q.sequelize.query("DELETE FROM account_actions WHERE kind = 'invite'", { transaction });
    });
  },
  async down(q) {
    await q.sequelize.transaction(async transaction => {
      const [rows] = await q.sequelize.query("SELECT * FROM invitations WHERE status = 'pending'", { transaction });
      for (const row of rows)
        await q.sequelize.query(
          `INSERT INTO account_actions (hash,kind,email,name,roles,"expiresAt","createdAt","updatedAt")
         VALUES (:hash,:kind,:email,:name,ARRAY[:roles]::varchar[],:expiresAt,:createdAt,NOW())
         ON CONFLICT (hash) DO NOTHING`,
          {
            replacements: {
              hash: row.tokenHash,
              kind: "invite",
              email: row.email,
              name: (row.firstName + " " + row.lastName).trim(),
              roles: row.roles,
              expiresAt: row.expiresAt,
              createdAt: row.createdAt
            },
            transaction
          }
        );
      await q.sequelize.query("DELETE FROM account_actions WHERE kind IN ('activate','email-change')", { transaction });
      await q.removeColumn("account_actions", "userId", { transaction });
      await q.removeColumn("account_actions", "targetEmail", { transaction });
      await q.dropTable("invitations", { transaction });
    });
  }
};
