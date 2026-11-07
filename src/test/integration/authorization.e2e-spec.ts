import { ApiValidationPipe } from "../../shared/presentation/api-validation.pipe";
import { AuthUseCase } from "../helpers/usecases/AuthUseCase";
import { Test } from "@nestjs/testing";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";
import request from "supertest";
import { AppModule } from "../../app.module";
import { createSuperUser } from "../../../scripts/lib/super-user";
import { AccountMailer } from "../../modules/auth/domain/account-actions.repository";
import { IdentityRepository } from "../../modules/identity/domain/identity.repository";
import { syncPermissions } from "../../modules/authorization/infrastructure/sync-permissions";
describe("Dynamic roles and identity access (disposable PostgreSQL)", () => {
  let app,
    db: Sequelize,
    rootToken: string,
    adminToken: string,
    root,
    admin,
    customId: string,
    customUser,
    customToken: string;
  const emails: { email: string; token: string; kind: string }[] = [];
  beforeAll(async () => {
    if (process.env.BLUE_DENT_TEST_DATABASE !== "disposable") throw new Error("Disposable database required");
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AccountMailer)
      .useValue({
        send: async (email, kind, token) => {
          emails.push({ email, kind, token });
        }
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ApiValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    db = app.get(Sequelize);
    await syncPermissions(db);
    await createSuperUser(db, {
      firstName: "Role",
      lastName: "Operator",
      email: "roles-root@blue.test",
      password: "Abcd123!"
    });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "roles-root@blue.test", password: "Abcd123!" })
      .expect(200);
    rootToken = login.body.token;
    root = login.body.user;
    const created = await request(app.getHttpServer())
      .post("/users")
      .auth(rootToken, { type: "bearer" })
      .send({
        firstName: "Role",
        lastName: "Admin",
        email: "roles-admin@blue.test",
        password: "Abcd123!",
        roles: ["admin"]
      })
      .expect(201);
    admin = created.body;
    await db.query("UPDATE users SET verified=true WHERE id=:id", { replacements: { id: admin.id } });
    adminToken = (
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: admin.email, password: "Abcd123!" })
        .expect(200)
    ).body.token;
  }, 30000);
  afterAll(async () => {
    if (app) await app.close();
  });
  it("lets admins create bounded custom roles and rejects privilege amplification", async () => {
    const role = await request(app.getHttpServer())
      .post("/roles")
      .auth(adminToken, { type: "bearer" })
      .send({ name: "integration-reception", description: "Reception", permissions: ["auth:me", "users:read"] })
      .expect(403);
    expect(role.body).toHaveProperty("statusCode", 403);
    const created = await request(app.getHttpServer())
      .post("/roles")
      .auth(adminToken, { type: "bearer" })
      .send({ name: "integration-reception", description: "Reception", permissions: ["auth:me"] })
      .expect(201);
    customId = created.body.id;
    await request(app.getHttpServer())
      .post("/roles")
      .auth(adminToken, { type: "bearer" })
      .send({ name: "integration-reception", description: "Duplicate", permissions: [] })
      .expect(409);
    await request(app.getHttpServer())
      .post("/roles")
      .auth(rootToken, { type: "bearer" })
      .send({ name: "unknown-perm", description: "Invalid", permissions: ["invented:permission"] })
      .expect(400);
    await request(app.getHttpServer())
      .post("/roles")
      .auth(rootToken, { type: "bearer" })
      .send({ name: "superadmin", description: "Reserved", permissions: [] })
      .expect(400);
    const [system] = await db.query<{ id: string }>("SELECT id FROM roles WHERE name='admin'", {
      type: QueryTypes.SELECT
    });
    await request(app.getHttpServer())
      .put("/roles/" + system.id)
      .auth(rootToken, { type: "bearer" })
      .send({ name: "admin", description: "Overwrite", permissions: [] })
      .expect(403);
    await request(app.getHttpServer())
      .delete("/roles/" + system.id)
      .auth(rootToken, { type: "bearer" })
      .expect(403);
    await request(app.getHttpServer()).get("/permissions").auth(adminToken, { type: "bearer" }).expect(200);
  });
  it("activates identities with custom roles and applies role changes to existing sessions", async () => {
    const created = await request(app.getHttpServer())
      .post("/users")
      .auth(rootToken, { type: "bearer" })
      .send({
        firstName: " Custom ",
        lastName: " Member ",
        email: "custom-role@blue.test",
        password: "Abcd123!",
        roles: ["integration-reception"]
      })
      .expect(201);
    customUser = created.body;
    expect(customUser.name).toBe("Custom Member");
    await request(app.getHttpServer()).post("/auth/activation/request").send({ email: customUser.email }).expect(202);
    await request(app.getHttpServer())
      .post("/auth/activation/confirm")
      .send({ token: emails.find(e => e.email === customUser.email)!.token, password: "Abcd123!" })
      .expect(204);
    customToken = (
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: customUser.email, password: "Abcd123!" })
        .expect(200)
    ).body.token;
    await request(app.getHttpServer())
      .put("/roles/" + customId)
      .auth(rootToken, { type: "bearer" })
      .send({ name: "integration-reception", description: "Own identity", permissions: ["auth:me", "users:read"] })
      .expect(200);
    customToken = (await AuthUseCase.resolve(app).login(customUser.email, "Abcd123!")).token;
    await request(app.getHttpServer())
      .get("/users/" + customUser.id)
      .auth(customToken, { type: "bearer" })
      .expect(200);
    await request(app.getHttpServer())
      .get("/users/" + admin.id)
      .auth(customToken, { type: "bearer" })
      .expect(403);
    await request(app.getHttpServer()).get("/roles").auth(customToken, { type: "bearer" }).expect(403);
    await request(app.getHttpServer())
      .delete("/roles/" + customId)
      .auth(rootToken, { type: "bearer" })
      .expect(409);
    await request(app.getHttpServer())
      .put("/roles/" + customId)
      .auth(rootToken, { type: "bearer" })
      .send({
        name: "integration-reception",
        description: "Staff scope",
        permissions: ["auth:me", "users:read", "users:manage", "users:list"]
      })
      .expect(200);
    await request(app.getHttpServer()).get("/users").auth(customToken, { type: "bearer" }).expect(200);
    await syncPermissions(db);
    expect(
      (
        await request(app.getHttpServer())
          .get("/roles/" + customId)
          .auth(rootToken, { type: "bearer" })
          .expect(200)
      ).body.permissions
    ).toContain("users:manage");
  });
  it("protects assignments, unknown roles and system identities outside the guard", async () => {
    await request(app.getHttpServer())
      .patch("/users/" + customUser.id)
      .auth(rootToken, { type: "bearer" })
      .send({ roles: ["does-not-exist"] })
      .expect(400);
    await request(app.getHttpServer())
      .patch("/users/" + customUser.id)
      .auth(customToken, { type: "bearer" })
      .send({ roles: ["superadmin"] })
      .expect(403);
    const grant = await request(app.getHttpServer())
      .post("/roles")
      .auth(rootToken, { type: "bearer" })
      .send({
        name: "integration-editor",
        description: "Editor",
        permissions: ["users:update", "users:manage", "roles:assign"]
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch("/users/" + customUser.id)
      .auth(rootToken, { type: "bearer" })
      .send({ roles: [grant.body.name] })
      .expect(200);
    await request(app.getHttpServer())
      .patch("/users/" + root.id)
      .auth(customToken, { type: "bearer" })
      .send({ enabled: false })
      .expect(403);
    await request(app.getHttpServer())
      .patch("/users/" + customUser.id)
      .auth(customToken, { type: "bearer" })
      .send({ roles: ["superadmin"] })
      .expect(403);
    await request(app.getHttpServer())
      .patch("/users/" + customUser.id)
      .auth(rootToken, { type: "bearer" })
      .send({ firstName: "Changed" })
      .expect(200)
      .then(response => expect(response.body.name).toBe("Changed Member"));
    const repository = app.get(IdentityRepository) as IdentityRepository;
    const stale = (await repository.read(customUser.id))!;
    await db.query("UPDATE users SET \"passwordHash\"='new-secret-hash' WHERE id=:id", {
      replacements: { id: customUser.id }
    });
    await repository.update(stale, root, false);
    expect((await repository.read(customUser.id))!.props.passwordHash).toBe("new-secret-hash");
  });
  it("rechecks delegation when a pending invitation is accepted and prevents deleting its role", async () => {
    const role = (
      await request(app.getHttpServer())
        .post("/roles")
        .auth(adminToken, { type: "bearer" })
        .send({ name: "integration-invited", description: "Invited", permissions: ["auth:me"] })
        .expect(201)
    ).body;
    await db.query(
      "INSERT INTO role_permissions (\"roleId\",\"permissionCode\") SELECT id,'invitations:create' FROM roles WHERE name='admin' ON CONFLICT DO NOTHING"
    );
    await request(app.getHttpServer())
      .post("/auth/invitations")
      .auth(adminToken, { type: "bearer" })
      .send({
        clinicAssignments: [],
        firstName: "Pending",
        lastName: "Member",
        email: "pending-role@blue.test",
        roles: [role.name]
      })
      .expect(201);
    await request(app.getHttpServer())
      .delete("/roles/" + role.id)
      .auth(rootToken, { type: "bearer" })
      .expect(409);
    await request(app.getHttpServer())
      .put("/roles/" + role.id)
      .auth(rootToken, { type: "bearer" })
      .send({ name: role.name, description: "Expanded", permissions: ["auth:me", "users:manage"] })
      .expect(200);
    await request(app.getHttpServer())
      .post("/auth/invitations/accept")
      .send({ token: emails.find(e => e.email === "pending-role@blue.test")!.token, password: "Abcd123!" })
      .expect(403);
    await request(app.getHttpServer())
      .post("/auth/invitations")
      .auth(adminToken, { type: "bearer" })
      .send({
        clinicAssignments: [],
        firstName: "Denied",
        lastName: "Member",
        email: "denied-role@blue.test",
        roles: [role.name]
      })
      .expect(403);
  });
  it("does not treat an invitation with a deleted inviter as a legacy invitation", async () => {
    await request(app.getHttpServer())
      .post("/auth/invitations")
      .auth(adminToken, { type: "bearer" })
      .send({
        clinicAssignments: [],
        firstName: "After",
        lastName: "Deletion",
        email: "deleted-inviter@blue.test",
        roles: ["customer"]
      })
      .expect(201);
    await request(app.getHttpServer())
      .delete("/users/" + admin.id)
      .auth(rootToken, { type: "bearer" })
      .expect(200);
    await request(app.getHttpServer())
      .post("/auth/invitations/accept")
      .send({ token: emails.find(e => e.email === "deleted-inviter@blue.test")!.token, password: "Abcd123!" })
      .expect(403);
  });
});
