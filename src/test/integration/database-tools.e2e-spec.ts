import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Sequelize, QueryTypes } from "sequelize";
import { databaseOptions } from "../../../database/connection";
import { createSuperUser } from "../../../scripts/lib/super-user";
describe("TypeScript database commands", () => {
  const name = "blue_dent_tools_" + randomUUID().replace(/-/g, "");
  let admin: Sequelize, db: Sequelize;
  /**
   * Runs only against this suite's disposable database.
   * @returns Output of the successful command.
   * @param command Sequelize command to run.
   * @param args Optional command arguments.
   */
  function execute(command: string, ...args: string[]) {
    const result = spawnSync(process.execPath, ["-r", "ts-node/register", "scripts/database.ts", command, ...args], {
      env: { ...process.env, DB_NAME: name },
      encoding: "utf8",
      windowsHide: true
    });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Database command failed");
    return result.stdout;
  }
  beforeAll(async () => {
    if (process.env.BLUE_DENT_TEST_DATABASE !== "disposable") throw new Error("Disposable database required");
    admin = new Sequelize(databaseOptions());
    await admin.query(`CREATE DATABASE "${name}"`);
    db = new Sequelize({ ...databaseOptions(), database: name });
  });
  afterAll(async () => {
    if (db) await db.close();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.close();
    }
  });
  it("migrates TypeScript from scratch and adapts legacy history without replaying schema changes", async () => {
    execute("db:migrate");
    const id = randomUUID();
    await db.query(
      `INSERT INTO users (id,email,name,"firstName","lastName","passwordHash",enabled,verified,"createdAt","updatedAt")
      VALUES (:id,'preserved@blue.test','Test','Test','','unused',true,true,NOW(),NOW())`,
      { replacements: { id } }
    );
    await db.query("UPDATE \"SequelizeMeta\" SET name = REPLACE(name, '.ts', '.cjs')");
    expect(execute("db:migrate")).toContain("No migrations were executed");
    const names = await db.query<{ name: string }>('SELECT name FROM "SequelizeMeta"', { type: QueryTypes.SELECT });
    expect(names).toHaveLength(readdirSync("database/migrations").filter(name => name.endsWith(".ts")).length);
    expect(names.every(row => row.name.endsWith(".ts"))).toBe(true);
    const users = await db.query<{ id: string }>("SELECT id FROM users WHERE id = :id", {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    expect(users).toEqual([{ id }]);
    execute("db:migrate:undo");
    expect(await db.getQueryInterface().describeTable("plan_versions")).toHaveProperty("maxBeneficiaries");
    execute("db:migrate:undo");
    expect(await db.getQueryInterface().describeTable("plan_versions")).not.toHaveProperty("maxBeneficiaries");
    execute("db:migrate:undo");
    expect(await db.getQueryInterface().describeTable("plan_versions")).not.toHaveProperty("benefitIds");
    execute("db:migrate:undo");
    expect(await db.getQueryInterface().tableExists("plan_benefits")).toBe(false);
    execute("db:migrate:undo");
    expect(await db.getQueryInterface().describeTable("clinics")).not.toHaveProperty("icon");
    const creator = await createSuperUser(db, {
      firstName: "Migration",
      lastName: "Creator",
      email: "migration-creator@blue.test",
      password: "Abcd123!"
    });
    const recover = randomUUID(),
      revoked = randomUUID();
    await db.query(
      `INSERT INTO clinics (id,code,name,"createdAt","updatedAt")
       VALUES (:recover,'recover','Recover',NOW(),NOW()),(:revoked,'revoked','Revoked',NOW(),NOW())`,
      { replacements: { recover, revoked } }
    );
    await db.query(
      `INSERT INTO audit_events (id,"occurredAt","requestId","actorId","actorType",action,"resourceType","resourceId","before")
       VALUES (gen_random_uuid(),NOW(),gen_random_uuid(),:creator,'user','clinic.created','clinic',:recover,NULL),
       (gen_random_uuid(),NOW(),gen_random_uuid(),:creator,'user','clinic.created','clinic',:revoked,NULL),
       (gen_random_uuid(),NOW(),gen_random_uuid(),:creator,'user','clinic.staff-unassigned','clinic',:revoked,
        jsonb_build_object('userId',CAST(:creator AS UUID)))`,
      { replacements: { recover, revoked, creator: creator.id } }
    );
    execute("db:migrate");
    expect(
      await db.query('SELECT "clinicId" FROM clinic_staff WHERE "userId"=:id', {
        replacements: { id: creator.id },
        type: QueryTypes.SELECT
      })
    ).toEqual([{ clinicId: recover }]);
    expect(
      await db.query('SELECT title FROM notifications WHERE "userId"=:id AND title=:title', {
        replacements: { id: creator.id, title: "Acceso a una clínica" },
        type: QueryTypes.SELECT
      })
    ).toEqual([{ title: "Acceso a una clínica" }]);
    expect(await db.getQueryInterface().describeTable("clinics")).toHaveProperty("icon");
  }, 90000);
  it("rebuilds with TypeScript migrations and seeds three verified role accounts", async () => {
    execute("db:migrate:undo:all");
    execute("db:migrate");
    execute("db:seed:all");
    const users = await db.query<{ email: string; verified: boolean }>("SELECT email, verified FROM users", {
      type: QueryTypes.SELECT
    });
    expect(users).toHaveLength(3);
    expect(users.every(user => user.verified && user.email.endsWith("@blue-dent.test"))).toBe(true);
    expect(await db.query("SELECT code FROM clinics", { type: QueryTypes.SELECT })).toEqual([
      { code: "blue-care-test" }
    ]);
    expect(await db.query('SELECT "userId" FROM clinic_staff ORDER BY "userId"', { type: QueryTypes.SELECT })).toEqual([
      { userId: "00000000-0000-4000-8000-000000000001" },
      { userId: "00000000-0000-4000-8000-000000000002" }
    ]);
  }, 90000);
  it("rejects conflicting legacy and TypeScript records without partially rewriting history", async () => {
    const legacy = "202610280001-identity.cjs";
    await db.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name)', { replacements: { name: legacy } });
    expect(() => execute("db:migrate")).toThrow();
    const names = await db.query<{ name: string }>('SELECT name FROM "SequelizeMeta"', { type: QueryTypes.SELECT });
    expect(names).toHaveLength(readdirSync("database/migrations").filter(name => name.endsWith(".ts")).length + 1);
    expect(names.some(row => row.name === legacy)).toBe(true);
  }, 30000);
});
