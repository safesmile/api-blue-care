import { AuthUseCase } from "../../modules/auth/application/auth.usecase";
import testUsersSeeder from "../../../database/seeders/202610280001-test-users.cjs";
import { createSuperUser } from "../../../scripts/lib/super-user.cjs";
import { compare } from "bcryptjs";
import { syncPermissions } from "../../modules/authorization/infrastructure/sync-permissions";
import { DEFAULT_ROLE_PERMISSIONS } from "../../permissions";
import { REGISTERED_PERMISSIONS } from "../../modules/authorization/infrastructure/permission-registry";
const PERMISSIONS = REGISTERED_PERMISSIONS.map(permission => permission.shortcode);
import { QueryTypes } from "sequelize";
import { AppModule } from "../../app.module";
import { Test } from "@nestjs/testing";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import request from "supertest";

import { AccountMailer } from "../../modules/auth/domain/account-actions.repository";
import { UsersUseCase } from "../../modules/identity/application/users.usecase";
import { Sequelize } from "sequelize-typescript";
describe("Blue Dent with PostgreSQL", () => {
  let app: INestApplication;
  let token: string;
  let refreshToken: string;
  const emails: { email: string; kind: string; token: string }[] = [];
  beforeAll(async () => {
    if (process.env.BLUE_DENT_TEST_DATABASE !== "disposable")
      throw new Error("Use npm run test:integration for isolated database tests");
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AccountMailer)
      .useValue({
        send: (email: string, kind: string, token: string) => {
          emails.push({ email, kind, token });
          return Promise.resolve();
        }
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
      })
    );
    await app.init();
    await syncPermissions(app.get(Sequelize));
    await createSuperUser(app.get(Sequelize), {
      firstName: "Admin",
      lastName: "Inicial",
      email: "admin@blue.test",
      password: "TestPassword123!"
    });
  }, 30000);
  afterAll(async () => {
    if (app) await app.close();
  });
  it("runs migrations without model/schema drift", async () => {
    const db = app.get(Sequelize);
    expect(await db.getQueryInterface().tableExists("sessions")).toBe(true);
    expect(await db.getQueryInterface().describeTable("users")).not.toHaveProperty("permissions");
    expect(await db.getQueryInterface().describeTable("account_actions")).not.toHaveProperty("permissions");
  });
  it("protects users by default and validates input", async () => {
    await request(app.getHttpServer()).get("/api/v1/users").expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "bad", password: "a", extra: true })
      .expect(400);
  });
  it("rejects bad credentials and signs in", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "admin@blue.test", password: "bad" })
      .expect(401);
    const result = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "admin@blue.test", password: "TestPassword123!" })
      .expect(200);
    token = result.body.token;
    refreshToken = result.body.refreshToken;
    expect(result.body.user.passwordHash).toBeUndefined();
    const [rows] = await app.get(Sequelize).query('SELECT "tokenHash" FROM sessions');
    expect(JSON.stringify(rows)).not.toContain(refreshToken);
  });
  it("implements explicit CRUD and permission checks", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/users")
      .auth(token, { type: "bearer" })
      .send({
        email: "staff@blue.test",
        name: "Staff",
        password: "TestPassword123!",
        roles: ["customer"]
      })
      .expect(201);
    const id = created.body.id;
    await request(app.getHttpServer())
      .get("/api/v1/users/" + id)
      .auth(token, { type: "bearer" })
      .expect(200);
    await request(app.getHttpServer())
      .patch("/api/v1/users/" + id)
      .auth(token, { type: "bearer" })
      .send({ name: "Dentist" })
      .expect(200);
    await request(app.getHttpServer()).get("/api/v1/users?limit=1000").auth(token, { type: "bearer" }).expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "staff@blue.test", password: "TestPassword123!" })
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/activation/request")
      .send({ email: "staff@blue.test" })
      .expect(202);
    await request(app.getHttpServer())
      .post("/api/v1/auth/activation/confirm")
      .send({
        token: emails.find(email => email.kind === "activate" && email.email === "staff@blue.test")!.token,
        password: "TestPassword123!"
      })
      .expect(204);
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "staff@blue.test", password: "TestPassword123!" })
      .expect(200);
    await request(app.getHttpServer()).get("/api/v1/users").auth(login.body.token, { type: "bearer" }).expect(403);
    await request(app.getHttpServer())
      .delete("/api/v1/users/" + id)
      .auth(token, { type: "bearer" })
      .expect(200);
  });
  it("allows only one concurrent refresh and invalidates old access", async () => {
    const results = await Promise.all(
      [1, 2].map(() => request(app.getHttpServer()).post("/api/v1/auth/refresh").send({ refreshToken }))
    );
    expect(results.map(r => r.status).sort()).toEqual([200, 401]);
    await request(app.getHttpServer()).get("/api/v1/auth/me").auth(token, { type: "bearer" }).expect(401);
    const successful = results.find(r => r.status === 200)!;
    token = successful.body.token;
    refreshToken = successful.body.refreshToken;
  });
  it("accepts invitations only once and resets passwords revoking sessions", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/invitations")
      .auth(token, { type: "bearer" })
      .send({ email: "invite@blue.test", firstName: "Invited", lastName: "Customer", roles: ["customer"] })
      .expect(201);
    const invitation = emails.find(e => e.kind === "invite")!;
    const input = { token: invitation.token, password: "TestPassword123!" };
    await request(app.getHttpServer()).post("/api/v1/auth/invitations/accept").send(input).expect(204);
    await request(app.getHttpServer()).post("/api/v1/auth/invitations/accept").send(input).expect(410);
    await request(app.getHttpServer())
      .post("/api/v1/auth/password/forgot")
      .send({ email: "admin@blue.test" })
      .expect(202);
    await request(app.getHttpServer())
      .post("/api/v1/auth/password/reset")
      .send({
        token: emails.find(e => e.kind === "reset")!.token,
        password: "NewPassword456!"
      })
      .expect(204);
    await request(app.getHttpServer()).get("/api/v1/auth/me").auth(token, { type: "bearer" }).expect(401);
  });
  it("rejects expired sessions and revokes logout immediately", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "admin@blue.test", password: "NewPassword456!" })
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .send({ refreshToken: login.body.refreshToken })
      .expect(204);
    await request(app.getHttpServer()).get("/api/v1/auth/me").auth(login.body.token, { type: "bearer" }).expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
    const expired = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "admin@blue.test", password: "NewPassword456!" })
      .expect(200);
    await app.get(Sequelize).query('UPDATE sessions SET "expiresAt" = NOW() - interval $$1 second$$');
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: expired.body.refreshToken })
      .expect(401);
  });
  it("synchronizes every permission and default role idempotently", async () => {
    const db = app.get(Sequelize);
    await syncPermissions(db);
    const [first] = await db.query("SELECT id, name FROM roles ORDER BY name");
    await syncPermissions(db);
    const [second] = await db.query("SELECT id, name FROM roles ORDER BY name");
    expect(second).toEqual(first);
    const rows = await db.query<{ shortcode: string }>("SELECT shortcode FROM permissions ORDER BY shortcode", {
      type: QueryTypes.SELECT
    });
    expect(rows.map(row => row.shortcode)).toEqual([...PERMISSIONS].sort());
    for (const [name, definition] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const grants = await db.query<{ code: string }>(
        'SELECT rp."permissionCode" AS code FROM "role_permissions" rp JOIN roles r ON r.id = rp."roleId" WHERE r.name = :name ORDER BY code',
        { replacements: { name }, type: QueryTypes.SELECT }
      );
      expect(grants.map(row => row.code)).toEqual(
        [...(definition.permissions === "*" ? PERMISSIONS : definition.permissions)].sort()
      );
    }
  });
  it("reads current grants and restores default role permissions on sync", async () => {
    const db = app.get(Sequelize);
    const login = await app.get(AuthUseCase).login("invite@blue.test", "TestPassword123!");
    await request(app.getHttpServer()).get("/api/v1/auth/me").auth(login.token, { type: "bearer" }).expect(200);
    await db.query(
      'DELETE FROM role_permissions rp USING roles r WHERE rp."roleId" = r.id AND r.name = :name AND rp."permissionCode" = :code',
      { replacements: { name: "customer", code: "auth:me" } }
    );
    await request(app.getHttpServer()).get("/api/v1/auth/me").auth(login.token, { type: "bearer" }).expect(403);
    await syncPermissions(db);
    await request(app.getHttpServer()).get("/api/v1/auth/me").auth(login.token, { type: "bearer" }).expect(200);
  });
  it("provisions a verified superadmin with names, hashed credentials and synchronized roles", async () => {
    const db = app.get(Sequelize);
    const input = { firstName: "Ana", lastName: "López", email: "SUPER@BLUE.TEST", password: "Abcd123!" };
    const created = await createSuperUser(db, input);
    expect(created).toMatchObject({ verified: true, firstName: "Ana", lastName: "López", roles: ["superadmin"] });
    const rows = await db.query<{ verified: boolean; passwordHash: string; firstName: string; lastName: string }>(
      'SELECT verified,"passwordHash","firstName","lastName" FROM users WHERE id = :id',
      { replacements: { id: created.id }, type: QueryTypes.SELECT }
    );
    expect(rows[0].verified).toBe(true);
    expect(rows[0].passwordHash).not.toBe(input.password);
    expect(await compare(input.password, rows[0].passwordHash)).toBe(true);
    await expect(createSuperUser(db, input)).rejects.toThrow("Ya existe una cuenta");
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "super@blue.test", password: input.password })
      .expect(200);
    expect(login.body.user.roles).toEqual(["superadmin"]);
    expect(login.body.user.verified).toBe(true);
    expect(login.body.user.permissions.sort()).toEqual([...PERMISSIONS].sort());
  });
  it("persists role assignments and derives grants again after a user update", async () => {
    const users = app.get(UsersUseCase);
    const user = await users.create({
      email: "role-update@blue.test",
      name: "Role Update",
      password: "Abcd123!",
      roles: ["customer"]
    });
    expect(user.permissions).toEqual(["auth:email-change", "auth:me", "auth:password-change"]);
    const updated = await users.update(user.id, { roles: ["superadmin"] });
    expect(updated.roles).toEqual(["superadmin"]);
    expect([...updated.permissions].sort()).toEqual([...PERMISSIONS].sort());
    const stored = await users.read(user.id);
    expect(stored.roles).toEqual(["superadmin"]);
    expect([...stored.permissions].sort()).toEqual([...PERMISSIONS].sort());
    await users.update(user.id, { roles: ["customer"] });
    expect((await users.read(user.id)).permissions).toEqual(["auth:email-change", "auth:me", "auth:password-change"]);
  });
  it("seeds one verified user per role with the requested password, without duplicates", async () => {
    const db = app.get(Sequelize);
    const originalTotal = (await app.get(UsersUseCase).list({ limit: 100, offset: 0 })).total;
    await testUsersSeeder.up(db.getQueryInterface());
    await testUsersSeeder.up(db.getQueryInterface());
    const rows = await db.query<{
      email: string;
      verified: boolean;
      enabled: boolean;
      passwordHash: string;
      role: string;
    }>(
      `SELECT u.email,u.verified,u.enabled,u."passwordHash",r.name AS role
       FROM users u JOIN user_roles ur ON ur."userId"=u.id
       JOIN roles r ON r.id=ur."roleId" WHERE u.email IN (:emails) ORDER BY u.email`,
      {
        replacements: { emails: ["superadmin@blue-dent.test", "admin@blue-dent.test", "customer@blue-dent.test"] },
        type: QueryTypes.SELECT
      }
    );
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map(row => row.passwordHash)).size).toBe(3);
    for (const row of rows) {
      expect(row.email).toBe(row.role + "@blue-dent.test");
      expect(row.verified).toBe(true);
      expect(row.enabled).toBe(true);
      expect(await compare("Pa$$word123", row.passwordHash)).toBe(true);
      const login = await app.get(AuthUseCase).login(row.email, "Pa$$word123");
      expect(login.user.roles).toEqual([row.role]);
      expect(login.user.permissions.sort()).toEqual(
        row.role === "superadmin" ? [...PERMISSIONS].sort() : ["auth:email-change", "auth:me", "auth:password-change"]
      );
    }
    await testUsersSeeder.down(db.getQueryInterface());
    const remaining = await db.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM users WHERE email IN (:emails)",
      { replacements: { emails: rows.map(row => row.email) }, type: QueryTypes.SELECT }
    );
    expect(remaining[0].count).toBe(0);
    expect((await app.get(UsersUseCase).list({ limit: 100, offset: 0 })).total).toBe(originalTotal);
    const collision = await app
      .get(UsersUseCase)
      .create({ email: "customer@blue-dent.test", name: "Existing", password: "Abcd123!", roles: ["admin"] });
    await expect(testUsersSeeder.up(db.getQueryInterface())).rejects.toThrow("conflicts with an existing account");
    expect((await app.get(UsersUseCase).read(collision.id)).roles).toEqual(["admin"]);
    expect((await app.get(UsersUseCase).list({ limit: 100, offset: 0 })).total).toBe(originalTotal + 1);
    await app.get(UsersUseCase).delete(collision.id);
  }, 15000);
  it("manages invitation previews, metadata, resends, expiration, acceptance and revocation", async () => {
    const db = app.get(Sequelize);
    const admin = await app.get(AuthUseCase).login("admin@blue.test", "NewPassword456!");
    const create = await request(app.getHttpServer())
      .post("/api/v1/auth/invitations")
      .auth(admin.token, { type: "bearer" })
      .send({ email: "lifecycle@blue.test", firstName: "Ana", lastName: "López", roles: ["customer"] })
      .expect(201);
    expect(create.body).toMatchObject({
      firstName: "Ana",
      lastName: "López",
      invitedBy: admin.user.id,
      status: "pending",
      deliveryStatus: "sent",
      acceptedAt: null
    });
    expect(create.body.tokenHash).toBeUndefined();
    const id = create.body.id;
    const originalToken = emails
      .filter(email => email.kind === "invite" && email.email === "lifecycle@blue.test")
      .at(-1)!.token;
    const preview = await request(app.getHttpServer())
      .get("/api/v1/auth/invitations/by-token")
      .query({ token: originalToken })
      .expect(200);
    expect(preview.body).toMatchObject({ firstName: "Ana", lastName: "López", status: "pending" });
    expect(preview.body.invitedByEmail).toBeUndefined();
    await request(app.getHttpServer()).get("/api/v1/auth/invitations").expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/invitations/" + id + "/resend")
      .auth(admin.token, { type: "bearer" })
      .expect(409);
    await db.query('UPDATE invitations SET "lastSendAttemptAt" = NOW() - interval $$61 seconds$$ WHERE id = :id', {
      replacements: { id }
    });
    await request(app.getHttpServer())
      .post("/api/v1/auth/invitations/" + id + "/resend")
      .auth(admin.token, { type: "bearer" })
      .expect(200);
    await request(app.getHttpServer())
      .get("/api/v1/auth/invitations/by-token")
      .query({ token: originalToken })
      .expect(404);
    const rotated = emails
      .filter(email => email.kind === "invite" && email.email === "lifecycle@blue.test")
      .at(-1)!.token;
    await db.query(
      'UPDATE invitations SET "expiresAt" = NOW() - interval $$1 second$$, "lastSendAttemptAt" = NOW() - interval $$61 seconds$$ WHERE id = :id',
      { replacements: { id } }
    );
    await request(app.getHttpServer()).get("/api/v1/auth/invitations/by-token").query({ token: rotated }).expect(410);
    await request(app.getHttpServer())
      .post("/api/v1/auth/invitations/" + id + "/resend")
      .auth(admin.token, { type: "bearer" })
      .expect(200);
    const live = emails.filter(email => email.kind === "invite" && email.email === "lifecycle@blue.test").at(-1)!.token;
    const attempts = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer()).post("/api/v1/auth/invitations/accept").send({ token: live, password: "Abcd123!" })
      )
    );
    expect(attempts.map(attempt => attempt.status).sort()).toEqual([204, 410]);
    const list = await request(app.getHttpServer())
      .get("/api/v1/auth/invitations")
      .auth(admin.token, { type: "bearer" })
      .expect(200);
    const accepted = list.body.items.find((item: { id: string }) => item.id === id);
    expect(accepted.status).toBe("accepted");
    expect(accepted.acceptedAt).toBeTruthy();
    expect(accepted.acceptedUserId).toBeTruthy();
    await request(app.getHttpServer()).get("/api/v1/auth/invitations/by-token").query({ token: live }).expect(410);
    const second = await request(app.getHttpServer())
      .post("/api/v1/auth/invitations")
      .auth(admin.token, { type: "bearer" })
      .send({ email: "revoked@blue.test", firstName: "Eva", lastName: "Prueba", roles: ["customer"] })
      .expect(201);
    const revoked = emails
      .filter(email => email.kind === "invite" && email.email === "revoked@blue.test")
      .at(-1)!.token;
    await request(app.getHttpServer())
      .post("/api/v1/auth/invitations/" + second.body.id + "/revoke")
      .auth(admin.token, { type: "bearer" })
      .expect(204);
    await request(app.getHttpServer())
      .post("/api/v1/auth/invitations/accept")
      .send({ token: revoked, password: "Abcd123!" })
      .expect(410);
  }, 15000);
  it("activates a registered customer, isolates account ownership and verifies channel changes", async () => {
    const users = app.get(UsersUseCase);
    const auth = app.get(AuthUseCase);
    const account = await users.create({
      email: "activation@blue.test",
      name: "Patient",
      password: "Abcd123!",
      roles: ["customer"]
    });
    expect(account.verified).toBe(false);
    await expect(auth.login("activation@blue.test", "Abcd123!")).rejects.toThrow();
    await request(app.getHttpServer())
      .post("/api/v1/auth/activation/request")
      .send({ email: "unknown@blue.test" })
      .expect(202);
    expect(emails.some(email => email.email === "unknown@blue.test")).toBe(false);
    await request(app.getHttpServer())
      .post("/api/v1/auth/activation/request")
      .send({ email: "activation@blue.test" })
      .expect(202);
    const activation = emails
      .filter(email => email.email === "activation@blue.test" && email.kind === "activate")
      .at(-1)!.token;
    await request(app.getHttpServer())
      .post("/api/v1/auth/activation/confirm")
      .send({ token: "0".repeat(80), password: "Abcd123!" })
      .expect(400);
    expect((await users.read(account.id)).verified).toBe(false);
    await request(app.getHttpServer())
      .post("/api/v1/auth/activation/confirm")
      .send({ token: activation, password: "Abcd123!" })
      .expect(204);
    expect((await users.read(account.id)).verified).toBe(true);
    const a = await auth.login("activation@blue.test", "Abcd123!");
    const b = await auth.login("invite@blue.test", "TestPassword123!");
    const own = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .query({ userId: b.user.id })
      .auth(a.token, { type: "bearer" })
      .expect(200);
    expect(own.body.id).toBe(account.id);
    await request(app.getHttpServer())
      .get("/api/v1/users/" + b.user.id)
      .auth(a.token, { type: "bearer" })
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/v1/auth/password/change")
      .auth(a.token, { type: "bearer" })
      .send({ currentPassword: "wrong", newPassword: "Changed123!" })
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/password/change")
      .auth(a.token, { type: "bearer" })
      .send({ currentPassword: "Abcd123!", newPassword: "Changed123!" })
      .expect(204);
    await request(app.getHttpServer()).get("/api/v1/auth/me").auth(a.token, { type: "bearer" }).expect(401);
    await request(app.getHttpServer()).post("/api/v1/auth/refresh").send({ refreshToken: a.refreshToken }).expect(401);
    const current = await auth.login("activation@blue.test", "Changed123!");
    await request(app.getHttpServer())
      .post("/api/v1/auth/email/change")
      .auth(current.token, { type: "bearer" })
      .send({ email: "verified-new@blue.test", currentPassword: "Changed123!" })
      .expect(202);
    expect((await users.read(account.id)).email).toBe("activation@blue.test");
    const emailToken = emails
      .filter(email => email.email === "verified-new@blue.test" && email.kind === "email-change")
      .at(-1)!.token;
    await request(app.getHttpServer())
      .post("/api/v1/auth/email/confirm")
      .send({ token: "0".repeat(80) })
      .expect(400);
    expect((await users.read(account.id)).email).toBe("activation@blue.test");
    await request(app.getHttpServer()).post("/api/v1/auth/email/confirm").send({ token: emailToken }).expect(204);
    expect((await users.read(account.id)).email).toBe("verified-new@blue.test");
    await request(app.getHttpServer()).get("/api/v1/auth/me").auth(current.token, { type: "bearer" }).expect(401);
    await request(app.getHttpServer()).get("/api/v1/auth/me").auth(b.token, { type: "bearer" }).expect(200);
    expect((await auth.login("verified-new@blue.test", "Changed123!")).user.id).toBe(account.id);
    await request(app.getHttpServer()).post("/api/v1/auth/email/confirm").send({ token: emailToken }).expect(400);
  }, 15000);
  it("allows only one recovery when two issued reset links are redeemed concurrently", async () => {
    const auth = app.get(AuthUseCase);
    const old = await auth.login("lifecycle@blue.test", "Abcd123!");
    await request(app.getHttpServer())
      .post("/api/v1/auth/password/forgot")
      .send({ email: "lifecycle@blue.test" })
      .expect(202);
    await request(app.getHttpServer())
      .post("/api/v1/auth/password/forgot")
      .send({ email: "lifecycle@blue.test" })
      .expect(202);
    const links = emails.filter(email => email.kind === "reset" && email.email === "lifecycle@blue.test").slice(-2);
    const passwords = ["ResetOne123!", "ResetTwo123!"];
    const results = await Promise.all(
      links.map((link, index) =>
        request(app.getHttpServer())
          .post("/api/v1/auth/password/reset")
          .send({ token: link.token, password: passwords[index] })
      )
    );
    expect(results.map(result => result.status).sort()).toEqual([204, 400]);
    await request(app.getHttpServer()).get("/api/v1/auth/me").auth(old.token, { type: "bearer" }).expect(401);
    const winner = results.findIndex(result => result.status === 204);
    expect((await auth.login("lifecycle@blue.test", passwords[winner])).user.id).toBe(old.user.id);
  }, 15000);
  it("verifies a pre-registered staff identity without creating another account", async () => {
    const users = app.get(UsersUseCase);
    const account = await users.create({
      email: "registered-admin@blue.test",
      name: "Staff",
      password: "Abcd123!",
      roles: ["admin"]
    });
    expect(account.verified).toBe(false);
    await request(app.getHttpServer())
      .post("/api/v1/auth/activation/request")
      .send({ email: account.email })
      .expect(202);
    const token = emails.filter(email => email.email === account.email && email.kind === "activate").at(-1)!.token;
    await request(app.getHttpServer())
      .post("/api/v1/auth/activation/confirm")
      .send({ token, password: "Abcd123!" })
      .expect(204);
    const verified = await users.read(account.id);
    expect(verified.verified).toBe(true);
    expect(verified.roles).toEqual(["admin"]);
  });
});
