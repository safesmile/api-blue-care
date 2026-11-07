import { ApiValidationPipe } from "../../shared/presentation/api-validation.pipe";
import { Test } from "@nestjs/testing";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../app.module";
import { createSuperUser } from "../../../scripts/lib/super-user";
import { AuthUseCase } from "../helpers/usecases/AuthUseCase";
import { AccountActionsUseCase } from "../helpers/usecases/AccountActionsUseCase";
import { AccountMailer } from "../../modules/auth/domain/account-actions.repository";
import { EmailSender } from "../../shared/domain/email-sender";
import { assignClinicOperator } from "../helpers/clinic-operator.fixture";
describe("Clinic roles and signed session selection (disposable PostgreSQL)", () => {
  let app,
    db: Sequelize,
    rootToken: string,
    root,
    ana,
    collaborator,
    clinicA,
    clinicB,
    clinicC,
    patientA,
    patientB,
    patientC,
    shared,
    eventA,
    eventB,
    selected,
    allSession;
  const mail: any[] = [],
    send = jest.fn(),
    password = "Abcd123!";
  const api = (token = rootToken) => ({
    get: (url: string) => request(app.getHttpServer()).get(url).auth(token, { type: "bearer" }),
    post: (url: string) => request(app.getHttpServer()).post(url).auth(token, { type: "bearer" }),
    put: (url: string) => request(app.getHttpServer()).put(url).auth(token, { type: "bearer" }),
    patch: (url: string) => request(app.getHttpServer()).patch(url).auth(token, { type: "bearer" }),
    delete: (url: string) => request(app.getHttpServer()).delete(url).auth(token, { type: "bearer" })
  });
  const account = async (email: string) => {
    const user = (
      await api()
        .post("/users")
        .send({ email, firstName: "Clinic", lastName: "Staff", password, roles: ["customer"] })
        .expect(201)
    ).body;
    await AccountActionsUseCase.resolve(app).requestActivation(email);
    await AccountActionsUseCase.resolve(app).redeem("activate", mail.findLast(m => m.email === email).token, password);
    return { user, ...(await AuthUseCase.resolve(app).login(email, password)) };
  };
  const assign = (userId: string, clinicId: string, roles: string[], token = rootToken) =>
    api(token)
      .put("/clinics/" + clinicId + "/staff/" + userId)
      .send({ roles });
  const patient = async (clinicId: string, name: string) =>
    (await api().post("/patients").send({ clinicId, firstName: name, lastName: "Patient" }).expect(201)).body;
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
    await app.listen(0, "127.0.0.1");
    db = app.get(Sequelize);
    await createSuperUser(db, { firstName: "Clinic", lastName: "Operator", email: "context-root@blue.test", password });
    root = await AuthUseCase.resolve(app).login("context-root@blue.test", password);
    rootToken = root.token;
    clinicA = (await api().post("/clinics").send({ code: "context-a", name: "Context A" }).expect(201)).body;
    clinicB = (await api().post("/clinics").send({ code: "context-b", name: "Context B" }).expect(201)).body;
    clinicC = (await api().post("/clinics").send({ code: "context-c", name: "Context C" }).expect(201)).body;
    ana = await account("context-ana@blue.test");
    collaborator = await account("context-colleague@blue.test");
    const reception = [
      "clinics:list",
      "clinics:read",
      "patients:read",
      "patients:list",
      "patients:create",
      "prevention:read"
    ];
    const admin = [
      ...reception,
      "patients:update",
      "dashboard:read",
      "prevention:complete",
      "prevention:create",
      "prevention:update",
      "prevention:cancel",
      "benefits:history",
      "clinics:staff-manage",
      "clinics:staff-list",
      "roles:assign",
      "invitations:create",
      "invitations:list",
      "invitations:resend",
      "invitations:revoke"
    ];
    await api()
      .post("/roles")
      .send({ name: "context-reception", description: "Reception", permissions: reception })
      .expect(201);
    await api()
      .post("/roles")
      .send({ name: "context-admin", description: "Clinic administrator", permissions: admin })
      .expect(201);
  }, 30000);
  afterAll(async () => {
    if (app) await app.close();
  });
  it("allows login with no clinics and exposes only assigned clinics, even to a platform operator", async () => {
    expect(ana.user.clinics).toEqual([]);
    expect(ana.user.mode).toBe("patient");
    expect(ana.user).not.toHaveProperty("clinicId");
    expect((await api().get("/clinics").expect(200)).body.total).toBe(0);
    expect((await api().get("/clinics/available").expect(200)).body.total).toBeGreaterThanOrEqual(3);
    await api().post("/patients").send({ clinicId: clinicC.id, firstName: "Denied", lastName: "Patient" }).expect(403);
    await api(ana.token).get("/patients").expect(403);
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: ana.user.email, password, clinicId: clinicC.id })
      .expect(403);
  });
  it("assigns different roles per clinic immediately and atomically creates access notifications", async () => {
    await assign(ana.user.id, clinicA.id, ["context-reception"]).expect(204);
    await assign(ana.user.id, clinicB.id, ["context-admin"]).expect(204);
    ana = await AuthUseCase.resolve(app).login(ana.user.email, password);
    const context = (await api(ana.token).get("/auth/me").expect(200)).body;
    expect(context.clinics.map(c => c.id).sort()).toEqual([clinicA.id, clinicB.id].sort());
    const rows = await db.query<{ clinicId: string; name: string }>(
      'SELECT ur."clinicId",r.name FROM user_roles ur JOIN roles r ON r.id=ur."roleId" WHERE ur."userId"=:id AND ur."clinicId" IS NOT NULL',
      { replacements: { id: ana.user.id }, type: QueryTypes.SELECT }
    );
    expect(rows).toHaveLength(2);
    const notices = (await api(ana.token).get("/notifications").expect(200)).body;
    expect(notices.items.filter(n => n.title === "Acceso a una clínica")).toHaveLength(2);
    expect(send).not.toHaveBeenCalled();
    await assign(ana.user.id, clinicA.id, ["context-reception"]).expect(204);
    expect(
      (await api(ana.token).get("/notifications").expect(200)).body.items.filter(
        n => n.title === "Acceso a una clínica"
      )
    ).toHaveLength(2);
    for (const clinic of [clinicA, clinicB, clinicC]) await assignClinicOperator(app, rootToken, clinic.id);
    patientA = await patient(clinicA.id, "OnlyA");
    patientB = await patient(clinicB.id, "OnlyB");
    patientC = await patient(clinicC.id, "OnlyC");
    shared = await patient(clinicA.id, "Shared");
    await api()
      .put("/patients/" + shared.id + "/clinics/" + clinicB.id)
      .expect(204);
    await api()
      .delete("/clinics/" + clinicC.id + "/staff/" + root.user.id)
      .expect(204);
  });
  it("assigns access type on the server and binds it to persisted sessions without a public switch", async () => {
    const session = await AuthUseCase.resolve(app).login(ana.user.email, password, clinicA.id);
    expect(session.user.mode).toBe("staff");
    expect(session.user).not.toHaveProperty("availableModes");
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: ana.user.email, password, mode: "patient" })
      .expect(400);
    await api(session.token)
      .post("/auth/switch-mode")
      .send({ refreshToken: session.refreshToken, mode: "patient" })
      .expect(404);
    const claims = app.get(JwtService).decode(session.token);
    const forged = app
      .get(JwtService)
      .sign(
        { sub: claims.sub, sid: claims.sid, mode: "patient" },
        { issuer: "blue-dent", audience: "blue-dent-api", algorithm: "HS256" }
      );
    await api(forged).get("/auth/me").expect(401);
    const renewed = await AuthUseCase.resolve(app).refresh(session.refreshToken);
    expect(renewed.user.mode).toBe("staff");
    expect(renewed.user.clinicId).toBe(clinicA.id);
    await api(session.token).get("/auth/me").expect(401);
    await api(renewed.token).get("/auth/me").expect(200);
  });
  it("keeps patient authentication independent from staff-clinic queries and rejects staff escalation", async () => {
    const queries: string[] = [];
    const original = db.query.bind(db);
    const spy = jest.spyOn(db, "query").mockImplementation(((sql, options) => {
      queries.push(typeof sql === "string" ? sql : sql.query);
      return original(sql, options);
    }) as typeof db.query);
    try {
      const personal = await AuthUseCase.resolve(app).login(collaborator.user.email, password);
      expect(personal.user.mode).toBe("patient");
      await api(personal.token).get("/auth/me").expect(200);
      await api(personal.token).get("/patients/me").expect(404);
      expect(queries.some(sql => /FROM clinics|JOIN clinic_staff/.test(sql))).toBe(false);
      const claims = app.get(JwtService).decode(personal.token);
      expect(claims).not.toHaveProperty("clinicId");
      await api(personal.token).get("/patients").expect(403);
      await api(personal.token)
        .post("/auth/switch-clinic")
        .send({ refreshToken: personal.refreshToken, clinicId: null })
        .expect(403);
      await api(personal.token)
        .post("/auth/switch-mode")
        .send({ refreshToken: personal.refreshToken, mode: "staff" })
        .expect(404);
      expect((await AuthUseCase.resolve(app).refresh(personal.refreshToken)).user.mode).toBe("patient");
    } finally {
      spy.mockRestore();
    }
  });
  it("registers a collaborator without clinics through an explicit invitation", async () => {
    const email = "context-empty-staff@blue.test";
    await api()
      .post("/auth/invitations")
      .send({ email, firstName: "Empty", lastName: "Staff", roles: ["customer"], staff: true, clinicAssignments: [] })
      .expect(201);
    await request(app.getHttpServer())
      .post("/auth/invitations/accept")
      .send({ token: mail.findLast(item => item.email === email).token, password })
      .expect(204);
    const session = await AuthUseCase.resolve(app).login(email, password);
    expect(session.user.mode).toBe("staff");
    expect(session.user.clinicId).toBeNull();
    expect(session.user.clinics).toEqual([]);
    await api(session.token).get("/auth/me").expect(200);
    await api(session.token).get("/patients").expect(403);
    const refreshed = await AuthUseCase.resolve(app).refresh(session.refreshToken);
    expect(refreshed.user.mode).toBe("staff");
  });
  it("filters all-clinics reads and checks the write permission in the resource clinic rather than the union", async () => {
    const list = (await api(ana.token).get("/patients?limit=100").expect(200)).body;
    expect(list.items.map(p => p.id).sort()).toEqual([patientA.id, patientB.id, shared.id].sort());
    await api(ana.token)
      .get("/patients/" + patientC.id)
      .expect(404);
    await api()
      .get("/patients/" + patientC.id)
      .expect(404);
    await api(ana.token)
      .patch("/patients/" + patientA.id)
      .send({ phone: "+50255551111" })
      .expect(404);
    await api(ana.token)
      .patch("/patients/" + patientB.id)
      .send({ phone: "+50255552222" })
      .expect(200);
    await api(ana.token)
      .get("/benefits/clinics/" + clinicA.id + "/history")
      .expect(403);
    await api(ana.token)
      .get("/benefits/clinics/" + clinicB.id + "/history")
      .expect(200);
    await api(ana.token)
      .get("/dashboard?clinicId=" + clinicA.id)
      .expect(403);
    await api(ana.token)
      .get("/dashboard?clinicId=" + clinicB.id)
      .expect(200);
  });
  it("signs a selected clinic, binds it to the persisted session and blocks query overrides", async () => {
    selected = await AuthUseCase.resolve(app).login(ana.user.email, password, clinicA.id);
    const payload = JSON.parse(Buffer.from(selected.token.split(".")[1], "base64url").toString("utf8"));
    expect(payload.clinicId).toBe(clinicA.id);
    const list = (await api(selected.token).get("/patients").expect(200)).body;
    expect(list.items.map(p => p.id).sort()).toEqual([patientA.id, shared.id].sort());
    await api(selected.token)
      .get("/patients?clinicId=" + clinicB.id)
      .expect(403);
    await api(selected.token)
      .get("/patients/" + patientB.id)
      .expect(404);
    await api(selected.token)
      .patch("/patients/" + shared.id)
      .send({ phone: "+50255554444" })
      .expect(403);
    const forged = app
      .get(JwtService)
      .sign(
        { sub: payload.sub, sid: payload.sid, clinicId: clinicB.id },
        { issuer: "blue-dent", audience: "blue-dent-api", algorithm: "HS256", expiresIn: 900 }
      );
    await api(forged).get("/auth/me").expect(401);
  });
  it("rotates context without extending the deadline and rejects the previous access and refresh credentials", async () => {
    const [before] = await db.query<{ absoluteExpiresAt: Date }>(
      'SELECT "absoluteExpiresAt" FROM sessions WHERE id=:id',
      {
        replacements: { id: JSON.parse(Buffer.from(selected.token.split(".")[1], "base64url").toString()).sid },
        type: QueryTypes.SELECT
      }
    );
    const switched = (
      await api(selected.token)
        .post("/auth/switch-clinic")
        .send({ refreshToken: selected.refreshToken, clinicId: clinicB.id })
        .expect(200)
    ).body;
    expect(switched.user.clinicId).toBe(clinicB.id);
    await api(selected.token).get("/auth/me").expect(401);
    await request(app.getHttpServer()).post("/auth/refresh").send({ refreshToken: selected.refreshToken }).expect(401);
    const [after] = await db.query<{ absoluteExpiresAt: Date }>(
      'SELECT "absoluteExpiresAt" FROM sessions WHERE id=:id',
      {
        replacements: { id: JSON.parse(Buffer.from(switched.token.split(".")[1], "base64url").toString()).sid },
        type: QueryTypes.SELECT
      }
    );
    expect(after.absoluteExpiresAt).toEqual(before.absoluteExpiresAt);
    await api(switched.token)
      .patch("/patients/" + patientB.id)
      .send({ phone: "+50255553333" })
      .expect(200);
    allSession = (
      await api(switched.token)
        .post("/auth/switch-clinic")
        .send({ refreshToken: switched.refreshToken, clinicId: null })
        .expect(200)
    ).body;
    expect(allSession.user.clinicId).toBeNull();
    expect((await api(allSession.token).get("/patients").expect(200)).body.total).toBe(3);
  });
  it("keeps event clinic checks and dashboard lists scoped in all mode", async () => {
    const type = (
      await api()
        .post("/prevention/types")
        .send({ code: "context-checkup", name: "Checkup", enabled: true })
        .expect(201)
    ).body;
    const input = {
      patientId: shared.id,
      typeId: type.id,
      dueAt: new Date(Date.now() + 86400000 * 10).toISOString(),
      status: "planned",
      intervalMonths: null
    };
    eventA = (
      await api()
        .post("/prevention/events")
        .send({ ...input, clinicId: clinicA.id, idempotencyKey: randomUUID() })
        .expect(201)
    ).body;
    eventB = (
      await api()
        .post("/prevention/events")
        .send({ ...input, clinicId: clinicB.id, idempotencyKey: randomUUID() })
        .expect(201)
    ).body;
    const complete = { expectedVersion: 1, occurredAt: new Date(Date.now() - 1000).toISOString() };
    await api(allSession.token)
      .post("/prevention/events/" + eventA.id + "/complete")
      .send(complete)
      .expect(403);
    const dashboard = (await api(allSession.token).get("/dashboard").expect(200)).body;
    expect(dashboard.upcomingPreventiveEvents).toBe(1);
    expect(
      (await api(allSession.token).get("/dashboard/prevention/upcoming").expect(200)).body.items.map(e => e.id)
    ).toEqual([eventB.id]);
    await api(allSession.token)
      .post("/prevention/events/" + eventB.id + "/complete")
      .send(complete)
      .expect(201);
  });
  it("lets clinic administrators assign only their clinics and prevents global role escalation", async () => {
    await assign(collaborator.user.id, clinicB.id, ["context-reception"], allSession.token).expect(204);
    await assign(collaborator.user.id, clinicA.id, ["context-reception"], allSession.token).expect(403);
    await assign(collaborator.user.id, clinicB.id, ["superadmin"], allSession.token).expect(400);
    await api(allSession.token)
      .post("/auth/invitations")
      .send({
        clinicAssignments: [],
        email: "context-escalate@blue.test",
        firstName: "Denied",
        lastName: "Role",
        roles: ["superadmin"]
      })
      .expect(403);
  });
  it("filters collaborator invitations and clinical audit even when other clinic metadata is administrable", async () => {
    const role = (
      await api()
        .post("/roles")
        .send({ name: "context-reserved", description: "Reserved in invitation", permissions: ["patients:read"] })
        .expect(201)
    ).body;
    const invitation = (
      await api()
        .post("/auth/invitations")
        .send({
          email: "context-clinic-c@blue.test",
          firstName: "Other",
          lastName: "Clinic",
          roles: ["customer"],
          clinicAssignments: [{ clinicId: clinicC.id, roles: ["context-reserved"] }]
        })
        .expect(201)
    ).body;
    const list = (await api(allSession.token).get("/auth/invitations").expect(200)).body;
    expect(list.items.some(item => item.id === invitation.id)).toBe(false);
    await api()
      .delete("/roles/" + role.id)
      .expect(409);
    const audits = (
      await api()
        .get("/audit?resourceType=clinic&resourceId=" + clinicC.id)
        .expect(200)
    ).body;
    expect(audits.total).toBe(0);
    const [record] = await db.query<{ id: string }>(
      'SELECT id FROM audit_events WHERE "resourceType"=\'clinic\' AND "resourceId"=:id LIMIT 1',
      { replacements: { id: clinicC.id }, type: QueryTypes.SELECT }
    );
    await api()
      .get("/audit/" + record.id)
      .expect(404);
    expect(
      (
        await api()
          .get("/audit?resourceType=clinic&resourceId=" + clinicA.id)
          .expect(200)
      ).body.total
    ).toBeGreaterThan(0);
  });
  it("rolls back staff and role grants when the assignment notification cannot be persisted", async () => {
    await db.query(`CREATE FUNCTION context_test_notice_failure() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
    IF NEW."userId"='${collaborator.user.id}' THEN RAISE EXCEPTION 'test'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER context_test_notice_failure BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION context_test_notice_failure()`);
    try {
      await assign(collaborator.user.id, clinicA.id, ["context-reception"]).expect(500);
    } finally {
      await db.query(
        "DROP TRIGGER context_test_notice_failure ON notifications; DROP FUNCTION context_test_notice_failure()"
      );
    }
    const [counts] = await db.query<{ staff: number; roles: number }>(
      `SELECT (SELECT COUNT(*)::int FROM clinic_staff WHERE "userId"=:id AND "clinicId"=:clinicId) AS staff,
    (SELECT COUNT(*)::int FROM user_roles WHERE "userId"=:id AND "clinicId"=:clinicId) AS roles`,
      { replacements: { id: collaborator.user.id, clinicId: clinicA.id }, type: QueryTypes.SELECT }
    );
    expect(counts).toEqual({ staff: 0, roles: 0 });
  });
  it("allows only one concurrent context switch to consume a refresh credential", async () => {
    const session = await AuthUseCase.resolve(app).login(ana.user.email, password, clinicA.id);
    const results = await Promise.all([
      api(session.token).post("/auth/switch-clinic").send({ refreshToken: session.refreshToken, clinicId: clinicB.id }),
      api(session.token).post("/auth/switch-clinic").send({ refreshToken: session.refreshToken, clinicId: null })
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 401]);
  });
  it("accepts clinic-role invitations atomically and revalidates authority before redemption", async () => {
    const input = {
      email: "context-invited@blue.test",
      staff: false,
      firstName: "Invited",
      lastName: "Staff",
      roles: ["customer"],
      clinicAssignments: [{ clinicId: clinicB.id, roles: ["context-reception"] }]
    };
    expect((await api(allSession.token).post("/auth/invitations").send(input).expect(201)).body.staff).toBe(true);
    const token = mail.findLast(m => m.email === input.email).token;
    await request(app.getHttpServer()).post("/auth/invitations/accept").send({ token, password }).expect(204);
    const invited = await AuthUseCase.resolve(app).login(input.email, password, clinicB.id);
    expect(invited.user.clinics.map(c => c.id)).toEqual([clinicB.id]);
    const unauthorized = { ...input, email: "context-revoked-inviter@blue.test" };
    await api(allSession.token).post("/auth/invitations").send(unauthorized).expect(201);
    await api()
      .delete("/clinics/" + clinicB.id + "/staff/" + ana.user.id)
      .expect(204);
    await request(app.getHttpServer())
      .post("/auth/invitations/accept")
      .send({ token: mail.findLast(m => m.email === unauthorized.email).token, password })
      .expect(403);
    const [count] = await db.query<{ total: number }>("SELECT COUNT(*)::int total FROM users WHERE email=:email", {
      replacements: { email: unauthorized.email },
      type: QueryTypes.SELECT
    });
    expect(count.total).toBe(0);
  });
  it("reflects removal immediately, still allows profile access and permits returning to no-clinic all mode", async () => {
    await api(allSession.token)
      .get("/patients/" + patientB.id)
      .expect(404);
    const context = (await api(allSession.token).get("/auth/me").expect(200)).body;
    expect(context.clinics.map(c => c.id)).toEqual([clinicA.id]);
    await api()
      .delete("/clinics/" + clinicA.id + "/staff/" + ana.user.id)
      .expect(204);
    const empty = await AuthUseCase.resolve(app).login(ana.user.email, password);
    expect(empty.user.mode).toBe("staff");
    expect(empty.user.clinics).toEqual([]);
    expect(empty.user.clinicId).toBeNull();
    expect((await api(empty.token).get("/auth/me").expect(200)).body.clinics).toEqual([]);
    await api(empty.token).get("/patients").expect(403);
    const notices = (await api(empty.token).get("/notifications").expect(200)).body;
    expect(notices.items.filter(n => n.title === "Se retiró tu acceso a una clínica")).toHaveLength(2);
  });
});
