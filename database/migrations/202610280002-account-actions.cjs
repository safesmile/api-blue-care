module.exports = {
  async up(q, S) {
    await q.createTable("account_actions", {
      hash: { type: S.STRING(64), primaryKey: true },
      kind: { type: S.STRING, allowNull: false },
      email: { type: S.STRING(254), allowNull: false },
      name: { type: S.STRING, allowNull: false },
      permissions: { type: S.ARRAY(S.STRING), allowNull: false },
      expiresAt: { type: S.DATE, allowNull: false },
      createdAt: { type: S.DATE, allowNull: false },
      updatedAt: { type: S.DATE, allowNull: false }
    });
    await q.addIndex("account_actions", ["expiresAt"]);
  },
  async down(q) {
    await q.dropTable("account_actions");
  }
};
