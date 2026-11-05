import type { QueryInterface } from "sequelize";
import type * as SequelizeTypes from "sequelize";
export = {
  async up(q: QueryInterface, S: typeof SequelizeTypes) {
    await q.sequelize.transaction(async transaction => {
      await q.createTable(
        "audit_events",
        {
          id: { type: S.UUID, primaryKey: true },
          occurredAt: { type: S.DATE, allowNull: false },
          requestId: { type: S.UUID, allowNull: false },
          actorId: { type: S.UUID, allowNull: true },
          actorType: { type: S.STRING(10), allowNull: false },
          actorName: { type: S.STRING(120) },
          action: { type: S.STRING(100), allowNull: false },
          resourceType: { type: S.STRING(60), allowNull: false },
          resourceId: { type: S.STRING(100), allowNull: false },
          reason: { type: S.STRING(500) },
          before: { type: S.JSONB },
          after: { type: S.JSONB }
        },
        { transaction }
      );
      await q.addIndex("audit_events", ["occurredAt", "id"], { transaction });
      await q.addIndex("audit_events", ["resourceType", "resourceId", "occurredAt"], { transaction });
      await q.addIndex("audit_events", ["actorId", "occurredAt"], { transaction });
      await q.sequelize.query(
        `CREATE FUNCTION blue_dent_audit_append_only() RETURNS trigger LANGUAGE PLPGSQL AS $$
        BEGIN RAISE EXCEPTION 'audit_events is append-only'; END; $$`,
        { transaction }
      );
      await q.sequelize.query(
        `CREATE TRIGGER audit_events_no_mutation BEFORE UPDATE OR DELETE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION blue_dent_audit_append_only()`,
        { transaction }
      );
      await q.sequelize.query(
        `CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events
        FOR EACH STATEMENT EXECUTE FUNCTION blue_dent_audit_append_only()`,
        { transaction }
      );
    });
  },
  async down(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      await q.dropTable("audit_events", { transaction });
      await q.sequelize.query("DROP FUNCTION blue_dent_audit_append_only()", { transaction });
    });
  }
};
