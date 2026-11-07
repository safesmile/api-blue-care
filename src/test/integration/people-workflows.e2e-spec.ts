import { ApiValidationPipe } from "../../shared/presentation/api-validation.pipe";
import { Test } from "@nestjs/testing";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";
import request from "supertest";
import { AppModule } from "../../app.module";
import { AuthUseCase } from "../helpers/usecases/AuthUseCase";
import { AccountMailer } from "../../modules/auth/domain/account-actions.repository";
import { createSuperUser } from "../../../scripts/lib/super-user";
import { assignClinicOperator } from "../helpers/clinic-operator.fixture";
describe("Separate collaborator and patient onboarding (disposable PostgreSQL)", () => {
  let app,
    db: Sequelize,
    root,
    selected,
    clinicA,
    clinicB,
    manager,
    receptionist,
    workerB,
    patientInvite,
    patientSession;
  const password = "Abcd123!",
    mail: { email: string; token: string }[] = [];
  const api = (token = root.token) => ({
    get: (path: string) => request(app.getHttpServer()).get(path).auth(token, { type: "bearer" }),
    post: (path: string) => request(app.getHttpServer()).post(path).auth(token, { type: "bearer" }),
    delete: (path: string) => request(app.getHttpServer()).delete(path).auth(token, { type: "bearer" })
  });
  const inviteStaff = async (email: string, clinicId: string, role: string) => {
    const invite = (
      await api()
        .post("/auth/invitations/collaborators")
        .send({ email, firstName: "Staff", lastName: "Test", clinicId, role })
        .expect(201)
    ).body;
    expect(invite).toMatchObject({ kind: "collaborator", staff: true, roles: ["staff"] });
    await request(app.getHttpServer())
      .post("/auth/invitations/accept")
      .send({ token: mail.findLast(item => item.email === email)!.token, password })
      .expect(204);
    return AuthUseCase.resolve(app).login(email, password, clinicId);
  };
  beforeAll(async () => {
    if (process.env.BLUE_DENT_TEST_DATABASE !== "disposable") throw new Error("Disposable database required");
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AccountMailer)
      .useValue({
        send: async (email: string, _kind: string, token: string) => {
          mail.push({ email, token });
        }
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ApiValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, "127.0.0.1");
    db = app.get(Sequelize);
    await createSuperUser(db, { email: "people-root@blue.test", firstName: "People", lastName: "Root", password });
    root = await AuthUseCase.resolve(app).login("people-root@blue.test", password);
    clinicA = (await api().post("/clinics").send({ code: "people-a", name: "People A" }).expect(201)).body;
    clinicB = (await api().post("/clinics").send({ code: "people-b", name: "People B" }).expect(201)).body;
    await assignClinicOperator(app, root.token, clinicA.id);
    await assignClinicOperator(app, root.token, clinicB.id);
    selected = await AuthUseCase.resolve(app).login("people-root@blue.test", password, clinicA.id);
    const reception = [
      "clinics:list",
      "clinics:read",
      "patients:list",
      "patients:read",
      "patients:create",
      "patients:update",
      "patients:link",
      "invitations:create",
      "invitations:list",
      "invitations:resend",
      "invitations:revoke"
    ];
    await api()
      .post("/roles")
      .send({ name: "people-reception", description: "Patient onboarding", permissions: reception })
      .expect(201);
    await api()
      .post("/roles")
      .send({
        name: "people-manager",
        description: "Staff manager",
        permissions: [...reception, "roles:assign", "clinics:staff-list", "clinics:staff-manage"]
      })
      .expect(201);
    manager = await inviteStaff("people-manager@blue.test", clinicA.id, "people-manager");
    receptionist = await inviteStaff("people-reception@blue.test", clinicA.id, "people-reception");
    workerB = await inviteStaff("people-worker-b@blue.test", clinicB.id, "people-reception");
  }, 30000);
  afterAll(async () => {
    if (app) await app.close();
  });
  it("creates collaborators with work access only and supplies bounded role choices", async () => {
    expect(manager.user.mode).toBe("staff");
    expect(manager.user.globalRoles).toEqual(["staff"]);
    expect(manager.user.permissions).not.toContain("patients:self");
    const options = (
      await api(manager.token)
        .get("/auth/invitations/collaborators/roles?clinicId=" + clinicA.id)
        .expect(200)
    ).body;
    expect(options.map(role => role.name)).toContain("people-reception");
    expect(options.some(role => ["customer", "staff", "superadmin", "admin"].includes(role.name))).toBe(false);
    for (const role of ["customer", "staff", "superadmin"])
      await api()
        .post("/auth/invitations/collaborators")
        .send({ email: "denied@blue.test", firstName: "Denied", lastName: "Role", clinicId: clinicA.id, role })
        .expect(400);
    await api(manager.token)
      .post("/auth/invitations/collaborators")
      .send({
        email: "outside@blue.test",
        firstName: "Denied",
        lastName: "Clinic",
        clinicId: clinicB.id,
        role: "people-reception"
      })
      .expect(403);
  });
  it("lists only staff and clinics within directory authority and keeps detail outside scope hidden", async () => {
    const visible = (await api(manager.token).get("/users/collaborators?limit=100").expect(200)).body;
    expect(visible.items.map(item => item.id)).toContain(receptionist.user.id);
    expect(visible.items.map(item => item.id)).not.toContain(workerB.user.id);
    expect(visible.items.every(item => item.clinics.every(clinic => clinic.id === clinicA.id))).toBe(true);
    expect(visible.items.every(item => !item.passwordHash && !item.permissions)).toBe(true);
    await api(manager.token)
      .get("/users/collaborators/" + workerB.user.id)
      .expect(404);
    await api(manager.token)
      .get("/users/collaborators/" + receptionist.user.id)
      .expect(200);
    await api(manager.token).get("/users").expect(403);
  });
  it("requires a selected current clinic and rejects patient role or staff assignment injection", async () => {
    const contact = { email: "people-patient@blue.test", firstName: "Patient", lastName: "Personal" };
    await api().post("/auth/invitations/patients").send(contact).expect(400);
    for (const extra of [
      { roles: ["admin"] },
      { staff: true },
      { clinicId: clinicB.id },
      { clinicAssignments: [{ clinicId: clinicB.id, roles: ["admin"] }] }
    ])
      await api(selected.token)
        .post("/auth/invitations/patients")
        .send({ ...contact, ...extra })
        .expect(400);
    expect(receptionist.user.permissions).not.toContain("roles:assign");
    patientInvite = (await api(receptionist.token).post("/auth/invitations/patients").send(contact).expect(201)).body;
    expect(patientInvite).toMatchObject({ kind: "patient", staff: false, roles: ["customer"], clinicAssignments: [] });
    expect(patientInvite.patientId).toBeTruthy();
    const [row] = await db.query<{ clinicId: string; userId: string | null }>(
      'SELECT pc."clinicId",p."userId" FROM patients p JOIN patient_clinics pc ON pc."patientId"=p.id WHERE p.id=:id',
      { replacements: { id: patientInvite.patientId }, type: QueryTypes.SELECT }
    );
    expect(row).toEqual({ clinicId: clinicA.id, userId: null });
    await api(receptionist.token)
      .get("/patients/" + patientInvite.patientId)
      .expect(200);
    const other = await AuthUseCase.resolve(app).login(root.user.email, password, clinicB.id);
    await api(other.token)
      .post("/auth/invitations/patients")
      .send({ ...contact, patientId: patientInvite.patientId })
      .expect(403);
  });
  it("creates a patient account and binds the clinical record without any staff access", async () => {
    await request(app.getHttpServer())
      .post("/auth/invitations/accept")
      .send({ token: mail.findLast(item => item.email === patientInvite.email)!.token, password })
      .expect(204);
    patientSession = await AuthUseCase.resolve(app).login(patientInvite.email, password);
    expect(patientSession.user.mode).toBe("patient");
    expect(patientSession.user.globalRoles).toEqual(["customer"]);
    expect(patientSession.user.clinics).toEqual([]);
    const claims = JSON.parse(Buffer.from(patientSession.token.split(".")[1], "base64url").toString());
    expect(claims).not.toHaveProperty("clinicId");
    expect((await api(patientSession.token).get("/patients/me").expect(200)).body.id).toBe(patientInvite.patientId);
    await api(patientSession.token).get("/clinics").expect(403);
    await api(patientSession.token).get("/users/collaborators").expect(403);
    expect(
      (await api().get("/users/collaborators?limit=100").expect(200)).body.items.map(item => item.id)
    ).not.toContain(patientSession.user.id);
  });
  it("filters invitation kinds before counting and pagination", async () => {
    const patients = (await api(selected.token).get("/auth/invitations?kind=patient&limit=1").expect(200)).body;
    expect(patients.total).toBe(1);
    expect(patients.items[0].kind).toBe("patient");
    const staff = (await api().get("/auth/invitations?kind=collaborator&limit=1").expect(200)).body;
    expect(staff.total).toBe(3);
    expect(staff.items[0].kind).toBe("collaborator");
    await api().get("/auth/invitations?kind=unknown").expect(400);
  });
  it("reuses pending patient records and allows resending without arbitrary role delegation", async () => {
    const contact = { email: "people-reuse@blue.test", firstName: "Reuse", lastName: "Patient" };
    const responses = await Promise.all([
      api(receptionist.token).post("/auth/invitations/patients").send(contact),
      api(receptionist.token).post("/auth/invitations/patients").send(contact)
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    const invite = responses.find(response => response.status === 201)!.body;
    await db.query("UPDATE invitations SET \"lastSendAttemptAt\"=NOW()-INTERVAL '61 seconds' WHERE id=:id", {
      replacements: { id: invite.id }
    });
    await api(receptionist.token)
      .post("/auth/invitations/" + invite.id + "/resend")
      .send({})
      .expect(200);
    await api(receptionist.token)
      .post("/auth/invitations/" + invite.id + "/revoke")
      .send({})
      .expect(204);
    const next = (await api(receptionist.token).post("/auth/invitations/patients").send(contact).expect(201)).body;
    expect(next.patientId).toBe(invite.patientId);
    const [count] = await db.query<{ total: number }>("SELECT COUNT(*)::int total FROM patients WHERE email=:email", {
      replacements: { email: contact.email },
      type: QueryTypes.SELECT
    });
    expect(count.total).toBe(1);
    await api()
      .delete("/clinics/" + clinicA.id + "/staff/" + receptionist.user.id)
      .expect(204);
    await request(app.getHttpServer())
      .post("/auth/invitations/accept")
      .send({ token: mail.findLast(item => item.email === contact.email)!.token, password })
      .expect(403);
    await request(app.getHttpServer())
      .put("/clinics/" + clinicB.id + "/staff/" + receptionist.user.id)
      .auth(root.token, { type: "bearer" })
      .send({ roles: ["people-reception"] })
      .expect(204);
    const moved = await AuthUseCase.resolve(app).login(receptionist.user.email, password, clinicB.id);
    await api(moved.token)
      .post("/auth/invitations/" + next.id + "/revoke")
      .send({})
      .expect(404);
  });
  it("does not combine patient invitation authority from different clinics during public acceptance", async () => {
    await api()
      .post("/roles")
      .send({
        name: "people-link-only",
        description: "Link without inviting",
        permissions: ["patients:create", "patients:link", "patients:read"]
      })
      .expect(201);
    await request(app.getHttpServer())
      .put("/clinics/" + clinicA.id + "/staff/" + receptionist.user.id)
      .auth(root.token, { type: "bearer" })
      .send({ roles: ["people-reception"] })
      .expect(204);
    const operator = await AuthUseCase.resolve(app).login(receptionist.user.email, password, clinicA.id);
    const email = "people-split-grants@blue.test";
    await api(operator.token)
      .post("/auth/invitations/patients")
      .send({ email, firstName: "Split", lastName: "Grants" })
      .expect(201);
    await request(app.getHttpServer())
      .put("/clinics/" + clinicA.id + "/staff/" + receptionist.user.id)
      .auth(root.token, { type: "bearer" })
      .send({ roles: ["people-link-only"] })
      .expect(204);
    await request(app.getHttpServer())
      .post("/auth/invitations/accept")
      .send({ token: mail.findLast(item => item.email === email)!.token, password })
      .expect(403);
    const [count] = await db.query<{ total: number }>("SELECT COUNT(*)::int total FROM users WHERE email=:email", {
      replacements: { email },
      type: QueryTypes.SELECT
    });
    expect(count.total).toBe(0);
  });
  it("allows the default clinic administrator to page and read only assigned patient records", async () => {
    const admin = await inviteStaff("people-read-admin@blue.test", clinicA.id, "admin");
    const create = async (clinicId: string, lastName: string) =>
      (await api().post("/patients").send({ firstName: "ReadScope", lastName, clinicId }).expect(201)).body;
    const first = await create(clinicA.id, "First");
    const second = await create(clinicA.id, "Second");
    const outside = await create(clinicB.id, "Outside");
    const all = await AuthUseCase.resolve(app).login(admin.user.email, password);
    const one = (await api(all.token).get("/patients?search=ReadScope&limit=1&offset=0").expect(200)).body;
    const two = (await api(all.token).get("/patients?search=ReadScope&limit=1&offset=1").expect(200)).body;
    expect(one.total).toBe(2);
    expect(two.total).toBe(2);
    expect(one.items).toHaveLength(1);
    expect(two.items).toHaveLength(1);
    expect(new Set([...one.items, ...two.items].map(item => item.id))).toEqual(new Set([first.id, second.id]));
    await api(admin.token)
      .get("/patients/" + first.id)
      .expect(200);
    await api(all.token)
      .get("/patients/" + outside.id)
      .expect(404);
    await request(app.getHttpServer())
      .patch("/patients/" + first.id)
      .auth(admin.token, { type: "bearer" })
      .send({ firstName: "Denied" })
      .expect(403);
    const invitation = (
      await api(admin.token)
        .post("/auth/invitations/patients")
        .send({ firstName: "Admin", lastName: "Invited", email: "admin-invited-patient@blue.test" })
        .expect(201)
    ).body;
    await db.query("UPDATE invitations SET \"lastSendAttemptAt\"=NOW()-INTERVAL '2 minutes' WHERE id=:id", {
      replacements: { id: invitation.id }
    });
    await api(admin.token)
      .post("/auth/invitations/" + invitation.id + "/resend")
      .send({})
      .expect(200);
    await api(admin.token)
      .post("/auth/invitations/" + invitation.id + "/revoke")
      .send({ reason: "Invitación de prueba" })
      .expect(204);
    const otherSession = await AuthUseCase.resolve(app).login(root.user.email, password, clinicB.id);
    const otherInvitation = (
      await api(otherSession.token)
        .post("/auth/invitations/patients")
        .send({ firstName: "Outside", lastName: "Invitation", email: "admin-outside-invitation@blue.test" })
        .expect(201)
    ).body;
    await db.query("UPDATE invitations SET \"lastSendAttemptAt\"=NOW()-INTERVAL '2 minutes' WHERE id=:id", {
      replacements: { id: otherInvitation.id }
    });
    const deliveriesBefore = mail.length;
    await api(admin.token)
      .post("/auth/invitations/" + otherInvitation.id + "/resend")
      .send({})
      .expect(403);
    await api(admin.token)
      .post("/auth/invitations/" + otherInvitation.id + "/revoke")
      .send({})
      .expect(403);
    expect(mail).toHaveLength(deliveriesBefore);
  });
});
