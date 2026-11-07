import { ApiValidationPipe } from "../../shared/presentation/api-validation.pipe";
import { AuthUseCase } from "../helpers/usecases/AuthUseCase";
import { Test } from "@nestjs/testing";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";
import request from "supertest";
import { AppModule } from "../../app.module";
import { createSuperUser } from "../../../scripts/lib/super-user";
import { AccountMailer } from "../../modules/auth/domain/account-actions.repository";
import { EmailSender } from "../../shared/domain/email-sender";
import { NotificationsUseCase } from "../helpers/usecases/NotificationsUseCase";
import type { AuditRecord } from "../../modules/audit/domain/audit.repository";
describe("Transactional audit and lifecycle outbox (disposable PostgreSQL)", () => {
  let app, db: Sequelize, rootToken: string, root, target, targetToken: string, role;
  const mail: { email: string; kind: string; token: string }[] = [],
    send = jest.fn().mockResolvedValue(undefined);
  /**
   * Reads only records belonging to this suite's resources.
   * @returns Matching persisted records.
   * @param action Lifecycle event name.
   * @param id Suite-owned resource identifier.
   */
  const records = (action: string, id: string) =>
    db.query<AuditRecord>(
      'SELECT * FROM audit_events WHERE action=:action AND "resourceId"=:id ORDER BY "occurredAt",id',
      { replacements: { action, id }, type: QueryTypes.SELECT }
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
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ApiValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    db = app.get(Sequelize);
    await createSuperUser(db, {
      firstName: "Audit",
      lastName: "Operator",
      email: "audit-root@blue.test",
      password: "Abcd123!"
    });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "audit-root@blue.test", password: "Abcd123!" })
      .expect(200);
    rootToken = login.body.token;
    root = login.body.user;
  }, 30000);
  afterAll(async () => {
    if (app) await app.close();
  });
  it("records actual actor, correlation and allowlisted snapshots without sending inline notifications", async () => {
    const created = await request(app.getHttpServer())
      .post("/users")
      .auth(rootToken, { type: "bearer" })
      .set("X-Actor-ID", "spoofed")
      .send({
        firstName: "Audit",
        lastName: "Member",
        email: "audit-member@blue.test",
        password: "Abcd123!",
        roles: ["customer"],
        reason: "Alta de prueba"
      })
      .expect(201);
    target = created.body;
    const [event] = await records("user.created", target.id);
    expect(event.actorId).toBe(root.id);
    expect(event.actorName).toBe("Audit Operator");
    expect(event.reason).toBe("Alta de prueba");
    expect(event.requestId).toBe(created.headers["x-request-id"]);
    expect(event.before).toBeNull();
    expect(event.after).toMatchObject({ email: target.email, verified: false });
    expect(event.after).not.toHaveProperty("passwordHash");
    expect(send).not.toHaveBeenCalled();
    await request(app.getHttpServer()).post("/auth/activation/request").send({ email: target.email }).expect(202);
    const token = mail.find(e => e.email === target.email && e.kind === "activate")!.token;
    await request(app.getHttpServer())
      .post("/auth/activation/confirm")
      .send({ token, password: "Abcd123!" })
      .expect(204);
    expect(JSON.stringify(await records("user.activated", target.id))).not.toContain(token);
    targetToken = (
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: target.email, password: "Abcd123!" })
        .expect(200)
    ).body.token;
  });
  it("requires explicit audit grants and supports filters and record detail", async () => {
    await request(app.getHttpServer()).get("/audit").auth(targetToken, { type: "bearer" }).expect(403);
    const updated = await request(app.getHttpServer())
      .patch("/users/" + target.id)
      .auth(rootToken, { type: "bearer" })
      .send({ firstName: "Updated", reason: "Corrección del nombre" })
      .expect(200);
    const [event] = await records("user.updated", target.id);
    expect(event.before?.firstName).toBe("Audit");
    expect(event.after?.firstName).toBe("Updated");
    expect(event.requestId).toBe(updated.headers["x-request-id"]);
    const result = await request(app.getHttpServer())
      .get("/audit")
      .auth(rootToken, { type: "bearer" })
      .query({
        resourceType: "user",
        resourceId: target.id,
        actorId: root.id,
        action: "user.updated",
        from: "2020-01-01T00:00:00Z",
        to: "2100-01-01T00:00:00Z"
      })
      .expect(200);
    expect(result.body.total).toBe(1);
    expect(result.body.items[0].id).toBe(event.id);
    await request(app.getHttpServer())
      .get("/audit/" + event.id)
      .auth(targetToken, { type: "bearer" })
      .expect(403);
    await request(app.getHttpServer())
      .get("/audit/" + event.id)
      .auth(rootToken, { type: "bearer" })
      .expect(200);
    role = (
      await request(app.getHttpServer())
        .post("/roles")
        .auth(rootToken, { type: "bearer" })
        .send({
          name: "audit-observer",
          description: "Audit observer",
          permissions: ["audit:list", "audit:read"],
          reason: "Acceso de auditoría"
        })
        .expect(201)
    ).body;
    await request(app.getHttpServer())
      .patch("/users/" + target.id)
      .auth(rootToken, { type: "bearer" })
      .send({ roles: ["customer", role.name] })
      .expect(200);
    targetToken = (await AuthUseCase.resolve(app).login(target.email, "Abcd123!")).token;
    await request(app.getHttpServer())
      .get("/audit/" + event.id)
      .auth(targetToken, { type: "bearer" })
      .expect(200);
    await request(app.getHttpServer()).get("/roles").auth(targetToken, { type: "bearer" }).expect(403);
    await request(app.getHttpServer())
      .patch("/users/" + target.id)
      .auth(rootToken, { type: "bearer" })
      .send({ firstName: "No", actorId: target.id })
      .expect(400);
    await request(app.getHttpServer())
      .patch("/users/" + target.id)
      .auth(rootToken, { type: "bearer" })
      .send({ reason: "x".repeat(501) })
      .expect(400);
  });
  it("commits role history and affected-user inbox entries together, avoiding no-op notices", async () => {
    const definition = {
      name: role.name,
      description: "Audit observer",
      permissions: ["audit:list", "audit:read", "auth:me"]
    };
    await request(app.getHttpServer())
      .put("/roles/" + role.id)
      .auth(rootToken, { type: "bearer" })
      .send(definition)
      .expect(200);
    const [event] = await records("role.updated", role.id);
    const notifications = await db.query<{ id: string }>(
      'SELECT id FROM notifications WHERE "userId"=:userId AND "eventKey"=:key',
      { replacements: { userId: target.id, key: "event:" + event.id + ":" + target.id }, type: QueryTypes.SELECT }
    );
    expect(notifications).toHaveLength(1);
    await request(app.getHttpServer())
      .put("/roles/" + role.id)
      .auth(rootToken, { type: "bearer" })
      .send({ ...definition, permissions: [...definition.permissions].reverse() })
      .expect(200);
    expect(await records("role.updated", role.id)).toHaveLength(1);
  });
  it("rolls back the original change when audit insertion or outbox persistence fails", async () => {
    const before = (await records("user.updated", target.id)).length;
    await db.query(`CREATE FUNCTION audit_test_fail_insert() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
      IF NEW.reason='force-audit-failure' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END; $$`);
    await db.query(
      "CREATE TRIGGER audit_test_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION audit_test_fail_insert()"
    );
    try {
      await request(app.getHttpServer())
        .patch("/users/" + target.id)
        .auth(rootToken, { type: "bearer" })
        .send({ firstName: "ShouldRollback", reason: "force-audit-failure" })
        .expect(500);
    } finally {
      await db.query("DROP TRIGGER audit_test_failure ON audit_events");
      await db.query("DROP FUNCTION audit_test_fail_insert()");
    }
    await db.query(`CREATE FUNCTION audit_test_fail_outbox() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
      IF NEW."userId"::text='${target.id}' THEN RAISE EXCEPTION 'forced outbox failure'; END IF; RETURN NEW; END; $$`);
    await db.query(
      "CREATE TRIGGER audit_test_outbox_failure BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION audit_test_fail_outbox()"
    );
    try {
      await request(app.getHttpServer())
        .patch("/users/" + target.id)
        .auth(rootToken, { type: "bearer" })
        .send({ firstName: "ShouldRollbackAgain" })
        .expect(500);
    } finally {
      await db.query("DROP TRIGGER audit_test_outbox_failure ON notifications");
      await db.query("DROP FUNCTION audit_test_fail_outbox()");
    }
    expect((await records("user.updated", target.id)).length).toBe(before);
    const [row] = await db.query<{ firstName: string }>('SELECT "firstName" FROM users WHERE id=:id', {
      replacements: { id: target.id },
      type: QueryTypes.SELECT
    });
    expect(row.firstName).toBe("Updated");
  });
  it("records credential changes without credentials and sends security email only from the durable worker", async () => {
    await request(app.getHttpServer())
      .post("/auth/password/change")
      .auth(targetToken, { type: "bearer" })
      .send({ currentPassword: "Abcd123!", newPassword: "Changed123!" })
      .expect(204);
    const [event] = await records("user.password-changed", target.id);
    expect(event.actorId).toBe(target.id);
    expect(JSON.stringify(event)).not.toContain("Abcd123!");
    expect(JSON.stringify(event)).not.toContain("Changed123!");
    expect(event.after).not.toHaveProperty("passwordHash");
    const [delivery] = await db.query<{ id: string; status: string }>(
      'SELECT d.id,d.status FROM notification_deliveries d JOIN notifications n ON n.id=d."notificationId" WHERE n."eventKey"=:key',
      { replacements: { key: "event:" + event.id + ":" + target.id }, type: QueryTypes.SELECT }
    );
    expect(delivery.status).toBe("pending");
    expect(send).not.toHaveBeenCalled();
    const notifications = NotificationsUseCase.resolve(app);
    expect(await notifications.deliver(delivery.id)).toBe(true);
    expect(await notifications.deliver(delivery.id)).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    await request(app.getHttpServer()).post("/auth/password/forgot").send({ email: target.email }).expect(202);
    const reset = mail.findLast(e => e.email === target.email && e.kind === "reset")!.token;
    await request(app.getHttpServer())
      .post("/auth/password/reset")
      .send({ token: reset, password: "ResetPass123!" })
      .expect(204);
    expect(JSON.stringify(await records("user.password-reset", target.id))).not.toContain(reset);
  });
  it("preserves invitation history safely and attributes revocation to the actual caller", async () => {
    const created = await request(app.getHttpServer())
      .post("/auth/invitations")
      .auth(rootToken, { type: "bearer" })
      .send({
        clinicAssignments: [],
        firstName: "Audit",
        lastName: "Invitee",
        email: "audit-invitation@blue.test",
        roles: ["customer"]
      })
      .expect(201);
    const token = mail.find(e => e.email === "audit-invitation@blue.test")!.token;
    const [event] = await records("invitation.created", created.body.id);
    expect(event.actorId).toBe(root.id);
    expect(event.after).not.toHaveProperty("tokenHash");
    expect(JSON.stringify(event)).not.toContain(token);
    await request(app.getHttpServer())
      .post("/auth/invitations/" + created.body.id + "/revoke")
      .auth(rootToken, { type: "bearer" })
      .send({ reason: "Invitación incorrecta" })
      .expect(204);
    const [revoked] = await records("invitation.revoked", created.body.id);
    expect(revoked.actorId).toBe(root.id);
    expect(revoked.reason).toBe("Invitación incorrecta");
  });
  it("rejects direct history mutation and keeps records when subjects and actors are deleted", async () => {
    const [event] = await records("user.created", target.id);
    await expect(
      db.query("UPDATE audit_events SET reason='rewrite' WHERE id=:id", { replacements: { id: event.id } })
    ).rejects.toThrow();
    await expect(
      db.query("DELETE FROM audit_events WHERE id=:id", { replacements: { id: event.id } })
    ).rejects.toThrow();
    await expect(db.query("TRUNCATE audit_events")).rejects.toThrow();
    await request(app.getHttpServer())
      .delete("/users/" + target.id)
      .auth(rootToken, { type: "bearer" })
      .send({ reason: "Baja de prueba" })
      .expect(200);
    expect(await records("user.created", target.id)).toHaveLength(1);
    await request(app.getHttpServer())
      .delete("/users/" + root.id)
      .auth(rootToken, { type: "bearer" })
      .expect(200);
    expect((await records("user.created", target.id))[0].actorName).toBe("Audit Operator");
    expect((await records("user.deleted", root.id))[0].actorId).toBe(root.id);
  });
});
