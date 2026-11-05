import type { QueryInterface } from "sequelize";
export = {
  async up(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      await q.sequelize.query(
        `
CREATE TABLE prevention_types (
 id UUID PRIMARY KEY, code VARCHAR(60) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL, enabled BOOLEAN NOT NULL,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE preventive_events (
 id UUID PRIMARY KEY, "patientId" UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
 "clinicId" UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
 "typeId" UUID NOT NULL REFERENCES prevention_types(id) ON DELETE RESTRICT, "typeName" VARCHAR(120) NOT NULL,
 "dueAt" TIMESTAMPTZ NOT NULL, status VARCHAR(20) NOT NULL CHECK(status IN ('planned','scheduled','completed','cancelled')),
 "intervalMonths" INTEGER CHECK("intervalMonths" BETWEEN 1 AND 120), "reminderHours" JSONB NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), "externalReference" VARCHAR(200),
 "completedAt" TIMESTAMPTZ, "cancelledAt" TIMESTAMPTZ,
 "followUpOfId" UUID UNIQUE REFERENCES preventive_events(id) ON DELETE RESTRICT,
 "idempotencyKey" UUID NOT NULL UNIQUE, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK((status='completed')=("completedAt" IS NOT NULL)), CHECK((status='cancelled')=("cancelledAt" IS NOT NULL)));
CREATE INDEX prevention_patient_timeline ON preventive_events("patientId","dueAt",id);
CREATE INDEX prevention_clinic_timeline ON preventive_events("clinicId",status,"dueAt",id);
CREATE TABLE preventive_reminders (
 id UUID PRIMARY KEY, "eventId" UUID NOT NULL REFERENCES preventive_events(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL, hours INTEGER NOT NULL CHECK(hours BETWEEN 1 AND 8760), "dueAt" TIMESTAMPTZ NOT NULL,
 status VARCHAR(20) NOT NULL CHECK(status IN ('pending','generated','cancelled','expired')),
 "notificationId" UUID REFERENCES notifications(id) ON DELETE SET NULL,
 UNIQUE("eventId",version,hours));
CREATE INDEX preventive_reminders_due ON preventive_reminders("dueAt",id) WHERE status='pending';
CREATE TABLE push_devices (
 id UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token TEXT NOT NULL, "tokenHash" VARCHAR(64) NOT NULL UNIQUE,
 platform VARCHAR(10) NOT NULL CHECK(platform IN ('web','android','ios')), enabled BOOLEAN NOT NULL DEFAULT TRUE,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX push_devices_owner ON push_devices("userId",enabled);
CREATE TABLE notification_push_deliveries (
 id UUID PRIMARY KEY, "notificationId" UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
 "deviceId" UUID NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,
 status VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0, lease UUID, "leasedUntil" TIMESTAMPTZ,
 "nextAttemptAt" TIMESTAMPTZ NOT NULL, "lastAttemptAt" TIMESTAMPTZ, "lastError" VARCHAR(40),
 UNIQUE("notificationId","deviceId"));
CREATE INDEX notification_push_pending ON notification_push_deliveries("nextAttemptAt",id) WHERE status='pending';
CREATE FUNCTION blue_care_prevention_history() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
 IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'Preventive evidence cannot be deleted'; END IF;
 IF OLD.status IN ('completed','cancelled') OR NEW.version <> OLD.version+1 OR
 ROW(OLD.id,OLD."patientId",OLD."clinicId",OLD."typeId",OLD."followUpOfId",OLD."idempotencyKey",OLD."createdAt")
 IS DISTINCT FROM ROW(NEW.id,NEW."patientId",NEW."clinicId",NEW."typeId",NEW."followUpOfId",NEW."idempotencyKey",NEW."createdAt")
 THEN RAISE EXCEPTION 'Invalid preventive transition'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER prevention_history BEFORE UPDATE OR DELETE ON preventive_events FOR EACH ROW EXECUTE FUNCTION blue_care_prevention_history();
CREATE TRIGGER prevention_no_truncate BEFORE TRUNCATE ON preventive_events FOR EACH STATEMENT EXECUTE FUNCTION blue_care_prevention_history();
`,
        { transaction }
      );
    });
  },
  async down(q: QueryInterface) {
    await q.sequelize.transaction(async transaction => {
      for (const table of [
        "notification_push_deliveries",
        "push_devices",
        "preventive_reminders",
        "preventive_events",
        "prevention_types"
      ])
        await q.dropTable(table, { transaction });
      await q.sequelize.query("DROP FUNCTION blue_care_prevention_history()", { transaction });
    });
  }
};
