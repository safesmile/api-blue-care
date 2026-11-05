import { PreventionRepository } from "../../modules/prevention/domain/prevention.repository";
import { Test } from "@nestjs/testing";
import { ValidationPipe } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../app.module";
import { createSuperUser } from "../../../scripts/lib/super-user";
import { AuthUseCase } from "../../modules/auth/application/auth.usecase";
import { AccountActionsUseCase } from "../../modules/auth/application/account-actions.usecase";
import { AccountMailer } from "../../modules/auth/domain/account-actions.repository";
import { EmailSender } from "../../shared/domain/email-sender";
import { PushSender, PushRepository, type PushDelivery } from "../../modules/notifications/domain/push.repository";
import { PushUseCase } from "../../modules/notifications/application/push.usecase";
import { NotificationsUseCase } from "../../modules/notifications/application/notifications.usecase";
import { PreventionUseCase } from "../../modules/prevention/application/prevention.usecase";
import { SqlPreventionRepository } from "../../modules/prevention/infrastructure/sql-prevention.repository";
import {
  MembershipGateway,
  MembershipBilling,
  type VerifiedPayment
} from "../../modules/memberships/domain/membership-billing";
import { MembershipsUseCase } from "../../modules/memberships/application/memberships.usecase";
describe("Prevention, reminders, push and dashboard (disposable PostgreSQL)", () => {
  let app, db: Sequelize, rootToken: string, clinicA, clinicB, owner, other, staffA, staffB, type, event, device;
  const mail: any[] = [],
    send = jest.fn(),
    pushSend = jest.fn().mockResolvedValue("sent"),
    payments = new Map<string, VerifiedPayment>();
  const api = (token = rootToken) => ({
    get: (url: string) => request(app.getHttpServer()).get(url).auth(token, { type: "bearer" }),
    post: (url: string) => request(app.getHttpServer()).post(url).auth(token, { type: "bearer" }),
    put: (url: string) => request(app.getHttpServer()).put(url).auth(token, { type: "bearer" }),
    patch: (url: string) => request(app.getHttpServer()).patch(url).auth(token, { type: "bearer" }),
    delete: (url: string) => request(app.getHttpServer()).delete(url).auth(token, { type: "bearer" })
  });
  const gateway = {
    available: () => true,
    checkout: async () => ({
      id: "ch_" + randomUUID().replace(/-/g, ""),
      url: "https://app.recurrente.com/checkout-session/test"
    }),
    payment: async (id: string) => payments.get(id) ?? null,
    checkoutState: async () => ({ expiredUnpaid: false, paymentId: null }),
    stop: async () => undefined,
    verify: jest.fn()
  };
  const account = async (email: string, roles: string[]) => {
    const user = (
      await api()
        .post("/users")
        .send({ email, firstName: "Preventive", lastName: "User", password: "Abcd123!", roles })
        .expect(201)
    ).body;
    await app.get(AccountActionsUseCase).requestActivation(email);
    await app
      .get(AccountActionsUseCase)
      .redeem("activate", mail.findLast(entry => entry.email === email).token, "Abcd123!");
    return { user, token: (await app.get(AuthUseCase).login(email, "Abcd123!")).token };
  };
  const create = (extra: Record<string, unknown> = {}) =>
    api()
      .post("/prevention/events")
      .send({
        patientId: owner.patient.id,
        clinicId: clinicA.id,
        typeId: type.id,
        dueAt: new Date(Date.now() + 8 * 86400000).toISOString(),
        status: "scheduled",
        intervalMonths: 6,
        reminderHours: [168, 24],
        idempotencyKey: randomUUID(),
        ...extra
      });
  const due = async (id: string, hours = 168) =>
    db.query(
      "UPDATE preventive_reminders SET \"dueAt\"=NOW()-INTERVAL '1 second' WHERE \"eventId\"=:id AND hours=:hours AND status='pending'",
      { replacements: { id, hours } }
    );
  beforeAll(async () => {
    if (process.env.BLUE_DENT_TEST_DATABASE !== "disposable") throw new Error("Disposable database required");
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AccountMailer)
      .useValue({
        send: async (email, kind, token) => {
          mail.push({ email, kind, token });
        }
      })
      .overrideProvider(EmailSender)
      .useValue({ send })
      .overrideProvider(PushSender)
      .useValue({ available: () => true, send: pushSend })
      .overrideProvider(MembershipGateway)
      .useValue(gateway)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, "127.0.0.1");
    db = app.get(Sequelize);
    await createSuperUser(db, {
      firstName: "Preventive",
      lastName: "Operator",
      email: "prevention-root@blue.test",
      password: "Abcd123!"
    });
    rootToken = (await app.get(AuthUseCase).login("prevention-root@blue.test", "Abcd123!")).token;
    clinicA = (await api().post("/clinics").send({ code: "preventive-a", name: "Preventive A" }).expect(201)).body;
    clinicB = (await api().post("/clinics").send({ code: "preventive-b", name: "Preventive B" }).expect(201)).body;
    await api()
      .post("/roles")
      .send({
        name: "preventive-scoped",
        description: "Preventive operator",
        permissions: [
          "prevention:read",
          "prevention:create",
          "prevention:update",
          "prevention:complete",
          "prevention:cancel",
          "dashboard:read"
        ]
      })
      .expect(201);
    staffA = await account("preventive-staff-a@blue.test", ["preventive-scoped"]);
    staffB = await account("preventive-staff-b@blue.test", ["preventive-scoped"]);
    await api()
      .put("/clinics/" + clinicA.id + "/staff/" + staffA.user.id)
      .expect(204);
    await api()
      .put("/clinics/" + clinicB.id + "/staff/" + staffB.user.id)
      .expect(204);
    owner = await account("preventive-owner@blue.test", ["customer"]);
    other = await account("preventive-other@blue.test", ["customer"]);
    for (const [person, clinic] of [
      [owner, clinicA],
      [other, clinicB]
    ]) {
      person.patient = (
        await api()
          .post("/patients")
          .send({ clinicId: clinic.id, firstName: "Preventive", lastName: "Patient", email: person.user.email })
          .expect(201)
      ).body;
      await api()
        .post("/patients/" + person.patient.id + "/account")
        .send({ userId: person.user.id })
        .expect(201);
    }
    type = (
      await api().post("/prevention/types").send({ code: "cleaning", name: "Limpieza", enabled: true }).expect(201)
    ).body;
  }, 30000);
  afterAll(async () => {
    if (app) await app.close();
  });
  it("tracks structured future events for a patient without membership and restricts patient and clinic scope", async () => {
    const input = {
      patientId: owner.patient.id,
      clinicId: clinicA.id,
      typeId: type.id,
      dueAt: new Date(Date.now() + 8 * 86400000).toISOString(),
      status: "scheduled",
      intervalMonths: 6,
      idempotencyKey: randomUUID(),
      externalReference: "external-appointment-1"
    };
    event = (await api(staffA.token).post("/prevention/events").send(input).expect(201)).body;
    const duplicate = (await api(staffA.token).post("/prevention/events").send(input).expect(201)).body;
    expect(duplicate.id).toBe(event.id);
    await api(staffA.token)
      .post("/prevention/events")
      .send({ ...input, dueAt: new Date(Date.now() + 9 * 86400000).toISOString() })
      .expect(409);
    expect((await api(owner.token).get("/prevention/me/events").expect(200)).body.items[0].id).toBe(event.id);
    await api(other.token)
      .get("/prevention/me/events/" + event.id)
      .expect(404);
    await api(owner.token)
      .get("/prevention/events/" + event.id)
      .expect(403);
    await api(staffB.token)
      .get("/prevention/events/" + event.id)
      .expect(404);
    await api(staffB.token)
      .patch("/prevention/events/" + event.id)
      .send({ dueAt: input.dueAt, status: "scheduled", intervalMonths: 6, expectedVersion: 1 })
      .expect(404);
    await create({ clinicId: clinicB.id }).expect(201);
    expect(
      (await api(staffA.token).get("/prevention/events").expect(200)).body.items.every(
        item => item.clinicId === clinicA.id
      )
    ).toBe(true);
    await api(staffA.token)
      .get("/dashboard?clinicId=" + clinicB.id)
      .expect(403);
    await api(owner.token).get("/dashboard").expect(403);
  });
  it("stores write-only owner devices, prevents token theft and keeps registration out of audit", async () => {
    const input = { token: "fcm-registration-opaque-prevention-owner-token", platform: "web" };
    device = (await api(owner.token).post("/notifications/devices").send(input).expect(201)).body;
    expect(device.token).toBeUndefined();
    expect((await api(owner.token).post("/notifications/devices").send(input).expect(201)).body.id).toBe(device.id);
    await api(other.token).post("/notifications/devices").send(input).expect(409);
    await api(other.token)
      .delete("/notifications/devices/" + device.id)
      .expect(404);
    const audit = await db.query('SELECT "after" FROM audit_events WHERE "resourceId"=:id', {
      replacements: { id: device.id },
      type: QueryTypes.SELECT
    });
    expect(JSON.stringify(audit)).not.toContain(input.token);
  });
  it("deduplicates concurrent reminder sweeps and creates inbox, email and push atomically", async () => {
    await due(event.id);
    const results = await Promise.all([app.get(PreventionUseCase).drain(), app.get(PreventionUseCase).drain()]);
    expect(results.reduce((n, r) => n + r.generated, 0)).toBe(1);
    const [row] = await db.query<{ notificationId: string }>(
      'SELECT "notificationId" FROM preventive_reminders WHERE "eventId"=:id AND hours=168',
      { replacements: { id: event.id }, type: QueryTypes.SELECT }
    );
    const [counts] = await db.query<{ email: number; push: number }>(
      'SELECT (SELECT COUNT(*)::int FROM notification_deliveries WHERE "notificationId"=:id) AS email,(SELECT COUNT(*)::int FROM notification_push_deliveries WHERE "notificationId"=:id) AS push',
      { replacements: { id: row.notificationId }, type: QueryTypes.SELECT }
    );
    expect(counts).toEqual({ email: 1, push: 1 });
    expect(send).not.toHaveBeenCalled();
    expect(pushSend).not.toHaveBeenCalled();
    const inbox = (await api(owner.token).get("/notifications").expect(200)).body;
    expect(JSON.stringify(inbox)).not.toContain("external-appointment-1");
  });
  it("invalidates generated pending deliveries on reschedule and rejects stale edits", async () => {
    const revised = {
      dueAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      status: "scheduled",
      intervalMonths: 3,
      reminderHours: [48, 12],
      expectedVersion: 1
    };
    const results = await Promise.all([
      api(staffA.token)
        .patch("/prevention/events/" + event.id)
        .send(revised),
      api(staffA.token)
        .patch("/prevention/events/" + event.id)
        .send(revised)
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    event = results.find(r => r.status === 200)!.body;
    const [old] = await db.query<{ cancelledAt: Date; status: string }>(
      `SELECT n."cancelledAt",d.status FROM notifications n
      JOIN notification_push_deliveries d ON d."notificationId"=n.id
      JOIN preventive_reminders r ON r."notificationId"=n.id WHERE r."eventId"=:id AND r.version=1`,
      { replacements: { id: event.id }, type: QueryTypes.SELECT }
    );
    expect(old.cancelledAt).not.toBeNull();
    expect(old.status).toBe("cancelled");
    const rows = await db.query<{ hours: number }>(
      "SELECT hours FROM preventive_reminders WHERE \"eventId\"=:id AND status='pending' ORDER BY hours",
      { replacements: { id: event.id }, type: QueryTypes.SELECT }
    );
    expect(rows.map(r => r.hours)).toEqual([12, 48]);
  });
  it("records completion once and derives the next planned date from this patient's selected interval", async () => {
    const occurredAt = new Date(Date.now() - 60000).toISOString();
    const results = await Promise.all([
      api(staffA.token)
        .post("/prevention/events/" + event.id + "/complete")
        .send({ expectedVersion: 2, occurredAt }),
      api(staffA.token)
        .post("/prevention/events/" + event.id + "/complete")
        .send({ expectedVersion: 2, occurredAt })
    ]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const result = results.find(r => r.status === 201)!.body;
    expect(result.event.status).toBe("completed");
    expect(result.next.status).toBe("planned");
    expect(result.next.followUpOfId).toBe(event.id);
    expect(result.next.intervalMonths).toBe(3);
    const history = (await api(owner.token).get("/prevention/me/events").expect(200)).body;
    expect(history.items.some(item => item.id === event.id && item.completedAt === occurredAt)).toBe(true);
    const single = (await create({ intervalMonths: null, reminderHours: [] }).expect(201)).body;
    await api()
      .post("/prevention/events/" + single.id + "/complete")
      .send({ expectedVersion: 1, occurredAt: new Date(Date.now() + 3600000).toISOString() })
      .expect(400);
    expect(
      (
        await api()
          .post("/prevention/events/" + single.id + "/complete")
          .send({ expectedVersion: 1, occurredAt })
          .expect(201)
      ).body.next
    ).toBeNull();
  });
  it("cancels and expires reminders without sending obsolete events", async () => {
    const cancelled = (await create().expect(201)).body;
    await due(cancelled.id);
    await api()
      .post("/prevention/events/" + cancelled.id + "/cancel")
      .send({ expectedVersion: 1, reason: "Appointment cancelled" })
      .expect(201);
    const expiring = (await create().expect(201)).body;
    await due(expiring.id);
    const clock = jest
      .spyOn(app.get(PreventionRepository) as SqlPreventionRepository, "now")
      .mockResolvedValue(new Date(Date.now() + 12 * 86400000));
    try {
      expect((await app.get(PreventionUseCase).drain()).generated).toBe(0);
    } finally {
      clock.mockRestore();
    }
    const [row] = await db.query<{ status: string }>(
      'SELECT status FROM preventive_reminders WHERE "eventId"=:id AND hours=168',
      { replacements: { id: expiring.id }, type: QueryTypes.SELECT }
    );
    expect(row.status).toBe("expired");
  });
  it("rolls back all reminder outputs if audit persistence fails and retries safely", async () => {
    const value = (await create().expect(201)).body;
    await due(value.id);
    await db.query(`CREATE FUNCTION prevention_test_failure() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
      IF NEW.action='prevention.reminder-generated' THEN RAISE EXCEPTION 'test'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER prevention_test_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION prevention_test_failure()`);
    try {
      await expect(app.get(PreventionUseCase).drain()).rejects.toThrow("rolled back");
    } finally {
      await db.query("DROP TRIGGER prevention_test_failure ON audit_events; DROP FUNCTION prevention_test_failure()");
    }
    const [row] = await db.query<{ status: string; notificationId: string | null }>(
      'SELECT status,"notificationId" FROM preventive_reminders WHERE "eventId"=:id AND hours=168',
      { replacements: { id: value.id }, type: QueryTypes.SELECT }
    );
    expect(row).toEqual({ status: "pending", notificationId: null });
    expect((await app.get(PreventionUseCase).drain()).generated).toBe(1);
  });
  it("uses per-device leases, rejects stale results, disables invalid tokens and honors revocation", async () => {
    const push: PushRepository = app.get(PushRepository);
    const ids = await push.pending();
    expect(ids.length).toBeGreaterThan(0);
    const id = ids[0];
    const claims = await Promise.all([push.claim(id), push.claim(id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const old = claims.find(Boolean) as PushDelivery;
    await db.query("UPDATE notification_push_deliveries SET \"leasedUntil\"=NOW()-INTERVAL '1 second' WHERE id=:id", {
      replacements: { id }
    });
    const current = (await push.claim(id))!;
    await push.finish(old, "sent", 5);
    expect(await push.claim(id)).toBeNull();
    await push.finish(current, "retry", 5);
    const [retried] = await db.query<{ status: string; lastError: string }>(
      'SELECT status,"lastError" FROM notification_push_deliveries WHERE id=:id',
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    expect(retried).toEqual({ status: "pending", lastError: "transport_failed" });
    await db.query("UPDATE notification_push_deliveries SET \"nextAttemptAt\"=NOW()-INTERVAL '1 second' WHERE id=:id", {
      replacements: { id }
    });
    pushSend.mockResolvedValueOnce("invalid");
    await app.get(PushUseCase).drain();
    const [disabled] = await db.query<{ enabled: boolean }>("SELECT enabled FROM push_devices WHERE id=:id", {
      replacements: { id: device.id },
      type: QueryTypes.SELECT
    });
    expect(disabled.enabled).toBe(false);
    await api(owner.token)
      .post("/notifications/devices")
      .send({ token: "fcm-registration-opaque-prevention-owner-token", platform: "web" })
      .expect(201);
    await api(owner.token)
      .delete("/notifications/devices/" + device.id)
      .expect(204);
    expect((await api(owner.token).get("/notifications/devices").expect(200)).body.items[0].enabled).toBe(false);
  });
  it("matches dashboard counts to eligible source records and filtered lists without multiplying patients by clinics", async () => {
    const plan = (await api().post("/plans").send({ code: "preventive-metric-plan" }).expect(201)).body;
    const version = (
      await api()
        .post("/plans/" + plan.id + "/versions")
        .send({
          name: "Metric fixture",
          description: "Test only",
          benefitDescriptions: [],
          monthlyPriceCents: 10000,
          taxDisclosure: "Test fixture"
        })
        .expect(201)
    ).body;
    await api()
      .post("/plans/" + plan.id + "/versions/" + version.id + "/publish")
      .expect(201);
    const member = (
      await api(owner.token).post("/memberships/me").send({ planVersionId: version.id, cadence: "monthly" }).expect(201)
    ).body;
    const checkout = (
      await api(owner.token)
        .post("/memberships/me/" + member.id + "/checkout")
        .expect(201)
    ).body;
    const paymentId = "in_" + randomUUID().replace(/-/g, "");
    payments.set(paymentId, {
      id: paymentId,
      amountCents: member.amountCents,
      currency: "GTQ",
      paidAt: new Date(),
      checkoutId: checkout.id,
      subscriptionId: "su_" + randomUUID().replace(/-/g, ""),
      membershipId: member.id
    });
    await app
      .get(MembershipBilling)
      .receive({ id: "msg_" + paymentId, resourceId: paymentId, eventType: "intent.succeeded" });
    await app.get(MembershipsUseCase).drain();
    const metrics = (
      await api(staffA.token)
        .get("/dashboard?days=60&clinicId=" + clinicA.id)
        .expect(200)
    ).body;
    const list = (
      await api(staffA.token)
        .get("/dashboard/memberships/expiring?days=60&clinicId=" + clinicA.id)
        .expect(200)
    ).body;
    const upcoming = (
      await api(staffA.token)
        .get("/dashboard/prevention/upcoming?days=60&clinicId=" + clinicA.id)
        .expect(200)
    ).body;
    expect(upcoming.total).toBe(metrics.upcomingPreventiveEvents);
    expect(metrics.activeMembers).toBe(1);
    expect(metrics.expiringMemberships).toBe(1);
    expect(list.total).toBe(metrics.expiringMemberships);
    expect(list.items[0].id).toBe(member.id);
    const [count] = await db.query<{ total: number }>(
      'SELECT COUNT(*)::int total FROM preventive_events WHERE "clinicId"=:id AND status IN (\'planned\',\'scheduled\') AND "dueAt">=:from AND "dueAt"< :to',
      { replacements: { id: clinicA.id, from: metrics.asOf, to: metrics.until }, type: QueryTypes.SELECT }
    );
    expect(metrics.upcomingPreventiveEvents).toBe(count.total);
    expect((await api(staffB.token).get("/dashboard?days=60").expect(200)).body.activeMembers).toBe(0);
    await api(owner.token)
      .post("/memberships/me/" + member.id + "/cancel")
      .expect(201);
    expect((await api(staffA.token).get("/dashboard?days=60").expect(200)).body.activeMembers).toBe(1);
    await api()
      .post("/memberships/" + member.id + "/suspend")
      .expect(201);
    expect((await api(staffA.token).get("/dashboard?days=60").expect(200)).body.activeMembers).toBe(0);
  });
  it("protects closed evidence, rejects ordinary JWTs on worker routes and never uses external transports", async () => {
    await expect(
      db.query('UPDATE preventive_events SET "dueAt"=NOW(),version=version+1 WHERE id=:id', {
        replacements: { id: event.id }
      })
    ).rejects.toThrow();
    await expect(db.query("TRUNCATE preventive_events CASCADE")).rejects.toThrow();
    await api().post("/internal/jobs/prevention/dispatch").expect(401);
    expect(send).not.toHaveBeenCalled();
    const notifications = app.get(NotificationsUseCase);
    await notifications.drain();
    expect(send).toHaveBeenCalled();
  });
});
