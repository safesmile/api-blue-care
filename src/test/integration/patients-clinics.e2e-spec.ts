import { ApiValidationPipe } from "../../shared/presentation/api-validation.pipe";
import { assignClinicOperator } from "../helpers/clinic-operator.fixture";
import { Test } from "@nestjs/testing";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";
import request from "supertest";
import { AppModule } from "../../app.module";
import { createSuperUser } from "../../../scripts/lib/super-user";
import { AccountMailer } from "../../modules/auth/domain/account-actions.repository";
import { EmailSender } from "../../shared/domain/email-sender";

describe("Patients, clinics and verified account binding (disposable PostgreSQL)", () => {
  let app,
    db: Sequelize,
    rootToken: string,
    staffToken: string,
    memberToken: string,
    staff,
    member,
    clinicA,
    clinicB,
    patientA,
    patientB;
  const mail: { email: string; kind: string; token: string }[] = [],
    send = jest.fn();
  const password = "Abcd123!";
  const api = (token = rootToken) => ({
    get: (path: string) => request(app.getHttpServer()).get(path).auth(token, { type: "bearer" }),
    post: (path: string) => request(app.getHttpServer()).post(path).auth(token, { type: "bearer" }),
    patch: (path: string) => request(app.getHttpServer()).patch(path).auth(token, { type: "bearer" }),
    put: (path: string) => request(app.getHttpServer()).put(path).auth(token, { type: "bearer" }),
    delete: (path: string) => request(app.getHttpServer()).delete(path).auth(token, { type: "bearer" })
  });
  const account = async (email: string, roles: string[]) => {
    const response = await api()
      .post("/users")
      .send({ email, firstName: "Account", lastName: "Example", roles, password })
      .expect(201);
    await request(app.getHttpServer()).post("/auth/activation/request").send({ email }).expect(202);
    const token = mail.findLast(item => item.email === email && item.kind === "activate")!.token;
    await request(app.getHttpServer()).post("/auth/activation/confirm").send({ token, password }).expect(204);
    const session = await request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(200);
    return { user: response.body, token: session.body.token };
  };
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
      firstName: "Patient",
      lastName: "Operator",
      email: "patient-root@blue.test",
      password
    });
    rootToken = (
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "patient-root@blue.test", password })
        .expect(200)
    ).body.token;
  }, 30000);
  afterAll(async () => {
    if (app) await app.close();
  });
  it("creates clinic catalog entries and independent patients without creating accounts or memberships", async () => {
    clinicA = (
      await api()
        .post("/clinics")
        .send({
          code: "suite-north",
          name: "North",
          address: "North address",
          phone: "12345678",
          email: "north@blue.test"
        })
        .expect(201)
    ).body;
    await assignClinicOperator(app, rootToken, clinicA.id);
    clinicB = (await api().post("/clinics").send({ code: "suite-south", name: "South" }).expect(201)).body;
    await assignClinicOperator(app, rootToken, clinicB.id);
    await api().post("/clinics").send({ code: "suite-north", name: "Duplicate" }).expect(409);
    patientA = (
      await api()
        .post("/patients")
        .send({
          clinicId: clinicA.id,
          firstName: "Ana",
          lastName: "Example",
          email: "patient-member@blue.test",
          dpi: "1234567890123",
          birthDate: "1990-10-15",
          phone: "55551234",
          address: "Patient address",
          reason: "Alta en recepción"
        })
        .expect(201)
    ).body;
    patientB = (
      await api().post("/patients").send({ clinicId: clinicB.id, firstName: "Other", lastName: "Patient" }).expect(201)
    ).body;
    expect(patientA.userId).toBeNull();
    const [count] = await db.query<{ total: number }>(
      "SELECT COUNT(*)::int total FROM users WHERE email='patient-member@blue.test'",
      { type: QueryTypes.SELECT }
    );
    expect(count.total).toBe(0);
    await api()
      .post("/patients")
      .send({ clinicId: clinicA.id, firstName: "Duplicate", lastName: "DPI", dpi: "1234567890123" })
      .expect(409);
    await api()
      .post("/patients")
      .send({ clinicId: clinicA.id, firstName: "Future", lastName: "Date", birthDate: "3000-01-01" })
      .expect(400);
    const found = await api().get("/patients?search=55551234").expect(200);
    expect(found.body.items.map(item => item.id)).toEqual([patientA.id]);
    expect(send).not.toHaveBeenCalled();
  });
  it("enforces clinic assignments and operation permissions for custom staff roles", async () => {
    await api()
      .post("/roles")
      .send({
        name: "suite-clinic-staff",
        description: "Scoped clinic operator",
        permissions: [
          "auth:me",
          "auth:password-change",
          "auth:email-change",
          "notifications:devices",
          "notifications:inbox",
          "notifications:read",
          "patients:self",
          "plans:catalog",
          "memberships:self",
          "benefits:self",
          "prevention:self",
          "clinics:list",
          "clinics:read",
          "clinics:update",
          "clinics:create",
          "clinics:staff-list",
          "clinics:staff-manage",
          "patients:list",
          "patients:read",
          "patients:create",
          "patients:update",
          "patients:link",
          "invitations:create",
          "roles:assign"
        ]
      })
      .expect(201);
    ({ user: staff, token: staffToken } = await account("patient-staff@blue.test", ["suite-clinic-staff"]));
    await api()
      .put("/clinics/" + clinicA.id + "/staff/" + staff.id)
      .send({ roles: ["customer"] })
      .expect(204);
    const catalog = await api(staffToken).get("/clinics").expect(200);
    expect(catalog.body.items.map(item => item.id)).toEqual([clinicA.id]);
    await api(staffToken)
      .get("/clinics/" + clinicB.id)
      .expect(403);
    await api(staffToken)
      .get("/patients/" + patientA.id)
      .expect(200);
    await api(staffToken)
      .get("/patients/" + patientB.id)
      .expect(404);
    const list = await api(staffToken).get("/patients").expect(200);
    expect(list.body.items.map(item => item.id)).toEqual([patientA.id]);
    await api(staffToken)
      .post("/patients")
      .send({ clinicId: clinicB.id, firstName: "No", lastName: "Access" })
      .expect(403);
    await api(staffToken)
      .patch("/patients/" + patientB.id)
      .send({ phone: "12345678" })
      .expect(404);
    await api(staffToken).post("/clinics").send({ code: "suite-unauthorized", name: "Denied" }).expect(403);
    await api(staffToken)
      .put("/clinics/" + clinicB.id + "/staff/" + staff.id)
      .send({ roles: ["customer"] })
      .expect(403);
    await api(staffToken)
      .put("/patients/" + patientB.id + "/clinics/" + clinicA.id)
      .expect(403);
  });
  it("applies staff assignment revocation to an already open session and preserves shared patients", async () => {
    await api()
      .delete("/clinics/" + clinicA.id + "/staff/" + staff.id)
      .expect(204);
    await api(staffToken)
      .get("/patients/" + patientA.id)
      .expect(403);
    await api(staffToken)
      .get("/clinics/" + clinicA.id)
      .expect(403);
    await api()
      .put("/clinics/" + clinicA.id + "/staff/" + staff.id)
      .send({ roles: ["customer"] })
      .expect(204);
    await api()
      .put("/patients/" + patientB.id + "/clinics/" + clinicA.id)
      .expect(204);
    await api(staffToken)
      .get("/patients/" + patientB.id)
      .expect(200);
    const locations = await api(staffToken)
      .get("/patients/" + patientB.id + "/clinics")
      .expect(200);
    expect(locations.body).toEqual([clinicA.id]);
    const allLocations = await api()
      .get("/patients/" + patientB.id + "/clinics")
      .expect(200);
    expect(allLocations.body).toHaveLength(2);
  });
  it("requires verified matching contact and unique identity binding before owner access", async () => {
    ({ user: member, token: memberToken } = await account("patient-member@blue.test", ["customer"]));
    await api(memberToken).get("/patients/me").expect(404);
    await api(memberToken)
      .get("/patients/" + patientA.id)
      .expect(403);
    await api()
      .post("/patients/" + patientB.id + "/account")
      .send({ userId: member.id })
      .expect(409);
    await api()
      .post("/patients/" + patientA.id + "/account")
      .send({ userId: staff.id })
      .expect(409);
    await api()
      .post("/patients/" + patientA.id + "/account")
      .send({ userId: member.id })
      .expect(201);
    const own = await api(memberToken).get("/patients/me").expect(200);
    expect(own.body.id).toBe(patientA.id);
    await api(memberToken).patch("/patients/me").send({ address: "Updated by owner", phone: null }).expect(200);
    await api(memberToken).patch("/patients/me").send({ userId: staff.id }).expect(400);
    await api(memberToken).get("/patients").expect(403);
    await api()
      .patch("/patients/" + patientA.id)
      .send({ email: "unverified-new@blue.test" })
      .expect(409);
    await api()
      .delete("/users/" + member.id)
      .expect(409);
    const duplicate = (
      await api()
        .post("/patients")
        .send({ clinicId: clinicA.id, firstName: "Shared", lastName: "Contact", email: member.email })
        .expect(201)
    ).body;
    await api()
      .post("/patients/" + duplicate.id + "/account")
      .send({ userId: member.id })
      .expect(409);
  });
  it("binds a patient invitation only after token verification and prevents cross-clinic invitation access", async () => {
    const patient = (
      await api()
        .post("/patients")
        .send({ clinicId: clinicB.id, firstName: "Invited", lastName: "Patient", email: "patient-invited@blue.test" })
        .expect(201)
    ).body;
    const input = {
      patientId: patient.id,
      firstName: "Invited",
      lastName: "Patient",
      email: patient.email,
      roles: ["customer"]
    };
    // This operator holds a linking grant but has no access to the patient's clinic.
    await api(staffToken)
      .post("/auth/invitations")
      .send({ clinicAssignments: [], ...input })
      .expect(403);
    await api()
      .post("/auth/invitations")
      .send({ clinicAssignments: [], ...input, email: "wrong@blue.test" })
      .expect(409);
    await api()
      .post("/auth/invitations")
      .send({ clinicAssignments: [], ...input })
      .expect(201);
    expect((await api().get("/patients/" + patient.id)).body.userId).toBeNull();
    const token = mail.findLast(item => item.email === patient.email && item.kind === "invite")!.token;
    await request(app.getHttpServer()).post("/auth/invitations/accept").send({ token, password }).expect(204);
    await request(app.getHttpServer()).post("/auth/invitations/accept").send({ token, password }).expect(410);
    const session = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: patient.email, password })
      .expect(200);
    expect((await api(session.body.token).get("/patients/me").expect(200)).body.id).toBe(patient.id);
  });
  it("keeps patient changes, audit and outbox atomic and stores no personal fields in notification bodies", async () => {
    await db.query(
      `CREATE FUNCTION suite_patient_audit_fail() RETURNS trigger LANGUAGE PLPGSQL AS $$
       BEGIN IF NEW."resourceId"='${patientA.id}' AND NEW.action='patient.updated'
       THEN RAISE EXCEPTION 'suite failure'; END IF; RETURN NEW; END; $$`
    );
    await db.query(
      "CREATE TRIGGER suite_patient_audit_fail BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION suite_patient_audit_fail()"
    );
    try {
      await api()
        .patch("/patients/" + patientA.id)
        .send({ phone: "99999999" })
        .expect(500);
      expect((await api().get("/patients/" + patientA.id)).body.phone).toBeNull();
    } finally {
      await db.query("DROP TRIGGER suite_patient_audit_fail ON audit_events");
      await db.query("DROP FUNCTION suite_patient_audit_fail()");
    }
    const changed = await api()
      .patch("/patients/" + patientA.id)
      .send({ phone: "88888888", reason: "Corrección de recepción" })
      .expect(200);
    const [event] = await db.query<{ actorId: string; reason: string; requestId: string }>(
      'SELECT "actorId",reason,"requestId" FROM audit_events WHERE "resourceId"=:id AND reason=:reason',
      { replacements: { id: patientA.id, reason: "Corrección de recepción" }, type: QueryTypes.SELECT }
    );
    expect(event.requestId).toBe(changed.headers["x-request-id"]);
    const inbox = await db.query<{ body: string }>('SELECT body FROM notifications WHERE "userId"=:id', {
      replacements: { id: member.id },
      type: QueryTypes.SELECT
    });
    expect(inbox.length).toBeGreaterThan(0);
    expect(JSON.stringify(inbox)).not.toContain("1234567890123");
    expect(JSON.stringify(inbox)).not.toContain("88888888");
    expect(send).not.toHaveBeenCalled();
  });
  it("propagates verified account email changes to the linked patient without creating a new identity", async () => {
    await api(memberToken)
      .post("/auth/email/change")
      .send({ email: "patient-new-contact@blue.test", currentPassword: password })
      .expect(202);
    const token = mail.findLast(
      item => item.email === "patient-new-contact@blue.test" && item.kind === "email-change"
    )!.token;
    await request(app.getHttpServer()).post("/auth/email/confirm").send({ token }).expect(204);
    const updated = await api()
      .get("/patients/" + patientA.id)
      .expect(200);
    expect(updated.body).toMatchObject({ userId: member.id, email: "patient-new-contact@blue.test" });
    await api(memberToken).get("/patients/me").expect(401);
  });
  it("serializes concurrent account links and rejects unverified matching accounts", async () => {
    const concurrent = await account("patient-concurrent@blue.test", ["customer"]);
    const input = { clinicId: clinicA.id, firstName: "Concurrent", lastName: "Contact", email: concurrent.user.email };
    const first = (await api().post("/patients").send(input).expect(201)).body;
    const second = (await api().post("/patients").send(input).expect(201)).body;
    const responses = await Promise.all([
      api()
        .post("/patients/" + first.id + "/account")
        .send({ userId: concurrent.user.id }),
      api()
        .post("/patients/" + second.id + "/account")
        .send({ userId: concurrent.user.id })
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    const rows = await db.query<{ id: string }>('SELECT id FROM patients WHERE "userId"=:id', {
      replacements: { id: concurrent.user.id },
      type: QueryTypes.SELECT
    });
    expect(rows).toHaveLength(1);
    const unverified = (
      await api()
        .post("/users")
        .send({
          firstName: "Unverified",
          lastName: "Contact",
          email: "patient-unverified@blue.test",
          password,
          roles: ["customer"]
        })
        .expect(201)
    ).body;
    const patient = (
      await api()
        .post("/patients")
        .send({ ...input, email: unverified.email })
        .expect(201)
    ).body;
    await api()
      .post("/patients/" + patient.id + "/account")
      .send({ userId: unverified.id })
      .expect(409);
  });
  it("revalidates the inviter's current clinic access during public token acceptance", async () => {
    const patient = (
      await api()
        .post("/patients")
        .send({
          clinicId: clinicA.id,
          firstName: "Pending",
          lastName: "Patient",
          email: "patient-pending-scope@blue.test"
        })
        .expect(201)
    ).body;
    await api(staffToken)
      .post("/auth/invitations")
      .send({
        clinicAssignments: [],
        patientId: patient.id,
        email: patient.email,
        firstName: patient.firstName,
        lastName: patient.lastName,
        roles: ["customer"]
      })
      .expect(201);
    const token = mail.findLast(item => item.email === patient.email && item.kind === "invite")!.token;
    await api()
      .delete("/clinics/" + clinicA.id + "/staff/" + staff.id)
      .expect(204);
    await request(app.getHttpServer()).post("/auth/invitations/accept").send({ token, password }).expect(403);
    const [count] = await db.query<{ total: number }>("SELECT COUNT(*)::int total FROM users WHERE email=:email", {
      replacements: { email: patient.email },
      type: QueryTypes.SELECT
    });
    expect(count.total).toBe(0);
    expect((await api().get("/patients/" + patient.id)).body.userId).toBeNull();
    await api()
      .put("/clinics/" + clinicA.id + "/staff/" + staff.id)
      .send({ roles: ["customer"] })
      .expect(204);
    await request(app.getHttpServer()).post("/auth/invitations/accept").send({ token, password }).expect(204);
  });
  it("removes a patient clinic association without deleting the shared record", async () => {
    await api(staffToken)
      .delete("/patients/" + patientB.id + "/clinics/" + clinicA.id)
      .expect(403);
    await api()
      .delete("/patients/" + patientB.id + "/clinics/" + clinicA.id)
      .send({ reason: "Corrección de asociación" })
      .expect(204);
    await api()
      .delete("/patients/" + patientB.id + "/clinics/" + clinicA.id)
      .expect(204);
    await api(staffToken)
      .get("/patients/" + patientB.id)
      .expect(404);
    expect(
      (
        await api()
          .get("/patients/" + patientB.id)
          .expect(200)
      ).body.id
    ).toBe(patientB.id);
    const rows = await db.query<{ id: string }>(
      'SELECT id FROM audit_events WHERE action=:action AND "resourceId"=:id',
      { replacements: { action: "patient.clinic-disassociated", id: patientB.id }, type: QueryTypes.SELECT }
    );
    expect(rows).toHaveLength(1);
  });
  it("deactivates clinics without erasing records and blocks new registrations there", async () => {
    await api()
      .patch("/clinics/" + clinicA.id)
      .send({ enabled: false })
      .expect(200);
    await api(staffToken)
      .get("/patients/" + patientA.id)
      .expect(403);
    await api().post("/patients").send({ clinicId: clinicA.id, firstName: "No", lastName: "Registration" }).expect(409);
    await api()
      .get("/patients/" + patientA.id)
      .expect(404);
    await api()
      .delete("/patients/" + patientA.id)
      .expect(404);
    await api()
      .delete("/clinics/" + clinicA.id)
      .expect(404);
    await api()
      .patch("/clinics/" + clinicA.id)
      .send({ enabled: true })
      .expect(200);
    await api(staffToken)
      .get("/patients/" + patientA.id)
      .expect(200);
  });
  it("retains clinic assignment history when an unlinked staff account is deleted", async () => {
    await api()
      .delete("/users/" + staff.id)
      .expect(200);
    const rows = await db.query<{ userId: string }>('SELECT "userId" FROM clinic_staff WHERE "userId"=:id', {
      replacements: { id: staff.id },
      type: QueryTypes.SELECT
    });
    expect(rows).toEqual([]);
    const events = await db.query<{ before: { userId: string }; actorName: string }>(
      `SELECT "before","actorName" FROM audit_events WHERE action='clinic.staff-unassigned'
       AND "resourceId"=:id AND "before"->>'userId'=:userId ORDER BY "occurredAt" DESC LIMIT 1`,
      { replacements: { id: clinicA.id, userId: staff.id }, type: QueryTypes.SELECT }
    );
    expect(events[0]).toMatchObject({ before: { userId: staff.id }, actorName: "Patient Operator" });
    await api(staffToken).get("/clinics").expect(401);
  });
});
