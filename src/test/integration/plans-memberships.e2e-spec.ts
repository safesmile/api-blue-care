import { ApiValidationPipe } from "../../shared/presentation/api-validation.pipe";
import { assignClinicOperator } from "../helpers/clinic-operator.fixture";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";
import { createHmac, randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../app.module";
import { createSuperUser } from "../../../scripts/lib/super-user";
import { AuthUseCase } from "../helpers/usecases/AuthUseCase";
import { AccountActionsUseCase } from "../helpers/usecases/AccountActionsUseCase";
import { AccountMailer } from "../../modules/auth/domain/account-actions.repository";
import { EmailSender } from "../../shared/domain/email-sender";
import { MembershipGateway, type VerifiedPayment } from "../../modules/memberships/domain/membership-billing";
import { RecurrenteGateway } from "../../modules/memberships/infrastructure/recurrente-gateway";
import { MembershipsUseCase } from "../helpers/usecases/MembershipsUseCase";

describe("Versioned plans, memberships and durable provider boundaries (disposable PostgreSQL)", () => {
  let app,
    db: Sequelize,
    service: ReturnType<typeof MembershipsUseCase.resolve>,
    rootToken: string,
    tokenA: string,
    tokenB: string,
    staffToken: string;
  let clinicA, clinicB, patientA, patientB, memberA, memberB, plan, v1, v2, contractA, contractB;
  const password = "Abcd123!",
    payments = new Map<string, VerifiedPayment>(),
    send = jest.fn();
  const mail: { email: string; kind: string; token: string }[] = [];
  const secret = "whsec_" + Buffer.from("membership-test-signing-key-32bytes").toString("base64");
  const verifier = new RecurrenteGateway(
    new ConfigService({ RECURRENTE_ENABLED: "true", RECURRENTE_WEBHOOK_SECRET: secret })
  );
  const gateway = {
    available: jest.fn().mockReturnValue(true),
    checkout: jest.fn(async () => {
      const id = "ch_" + randomUUID().replace(/-/g, "");
      return { id, url: "https://app.recurrente.com/checkout-session/" + id };
    }),
    payment: jest.fn(async (id: string) => payments.get(id) ?? null),
    checkoutState: jest.fn().mockResolvedValue({ expiredUnpaid: false, paymentId: null }),
    stop: jest.fn().mockResolvedValue(undefined),
    verify: (body: Buffer, headers: Record<string, unknown>) => verifier.verify(body, headers)
  };
  const api = (token = rootToken) => ({
    get: (path: string) => request(app.getHttpServer()).get(path).auth(token, { type: "bearer" }),
    post: (path: string) => request(app.getHttpServer()).post(path).auth(token, { type: "bearer" }),
    patch: (path: string) => request(app.getHttpServer()).patch(path).auth(token, { type: "bearer" }),
    put: (path: string) => request(app.getHttpServer()).put(path).auth(token, { type: "bearer" })
  });
  const event = (paymentId: string, messageId = "msg_" + paymentId, eventType = "intent.succeeded") => {
    const body = JSON.stringify({ id: paymentId, event_type: eventType, amount_in_cents: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
      .update(messageId + "." + timestamp + "." + body)
      .digest("base64");
    return request(app.getHttpServer())
      .post("/webhooks/recurrente")
      .set("Content-Type", "application/json")
      .set("svix-id", messageId)
      .set("svix-timestamp", timestamp)
      .set("svix-signature", "v1," + signature)
      .send(body);
  };
  const account = async (email: string, roles: string[]) => {
    const user = (
      await api().post("/users").send({ firstName: "Member", lastName: "Example", email, password, roles }).expect(201)
    ).body;
    await AccountActionsUseCase.resolve(app).requestActivation(email);
    const token = mail.findLast(item => item.email === email && item.kind === "activate")!.token;
    await AccountActionsUseCase.resolve(app).redeem("activate", token, password);
    const login = await AuthUseCase.resolve(app).login(email, password);
    return { user, token: login.token };
  };
  const versionInput = {
    name: "Blue Care +",
    description: "Plan comercial de prueba",
    benefitDescriptions: ["Descripción inicial"],
    monthlyPriceCents: 10000,
    taxDisclosure: "Importe final de prueba; no se cobran impuestos adicionales"
  };
  const ownedContract = async (email: string) => {
    const owner = await account(email, ["customer"]);
    const patient = (
      await api()
        .post("/patients")
        .send({ clinicId: clinicA.id, firstName: "Additional", lastName: "Member", email })
        .expect(201)
    ).body;
    await api()
      .post("/patients/" + patient.id + "/account")
      .send({ userId: owner.user.id })
      .expect(201);
    const contract = (
      await api(owner.token).post("/memberships/me").send({ planVersionId: v2.id, cadence: "monthly" }).expect(201)
    ).body;
    return { ...owner, contract };
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
      .overrideProvider(MembershipGateway)
      .useValue(gateway)
      .compile();
    app = module.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ApiValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    db = app.get(Sequelize);
    service = MembershipsUseCase.resolve(app);
    await createSuperUser(db, {
      firstName: "Billing",
      lastName: "Operator",
      email: "membership-root@blue.test",
      password
    });
    rootToken = (
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "membership-root@blue.test", password })
        .expect(200)
    ).body.token;
    clinicA = (await api().post("/clinics").send({ code: "membership-north", name: "Membership north" }).expect(201))
      .body;
    await assignClinicOperator(app, rootToken, clinicA.id);
    clinicB = (await api().post("/clinics").send({ code: "membership-south", name: "Membership south" }).expect(201))
      .body;
    await assignClinicOperator(app, rootToken, clinicB.id);
    ({ user: memberA, token: tokenA } = await account("membership-a@blue.test", ["customer"]));
    ({ user: memberB, token: tokenB } = await account("membership-b@blue.test", ["customer"]));
    patientA = (
      await api()
        .post("/patients")
        .send({ clinicId: clinicA.id, firstName: "Member", lastName: "A", email: memberA.email })
        .expect(201)
    ).body;
    patientB = (
      await api()
        .post("/patients")
        .send({ clinicId: clinicB.id, firstName: "Member", lastName: "B", email: memberB.email })
        .expect(201)
    ).body;
    await api()
      .post("/patients/" + patientA.id + "/account")
      .send({ userId: memberA.id })
      .expect(201);
    await api()
      .post("/patients/" + patientB.id + "/account")
      .send({ userId: memberB.id })
      .expect(201);
  }, 30000);
  afterAll(async () => {
    if (app) await app.close();
  });
  it("publishes immutable GTQ price versions and derives annual totals without creating memberships", async () => {
    plan = (await api().post("/plans").send({ code: "membership-blue-care-plus" }).expect(201)).body;
    expect((await api(tokenA).get("/plans/catalog").expect(200)).body.items.map(item => item.id)).not.toContain(
      plan.id
    );
    await api(tokenA)
      .get("/plans/" + plan.id)
      .expect(403);
    v1 = (
      await api()
        .post("/plans/" + plan.id + "/versions")
        .send(versionInput)
        .expect(201)
    ).body;
    expect(v1).toMatchObject({
      monthlyPriceCents: 10000,
      annualPriceCents: 100000,
      currency: "GTQ",
      number: 1,
      publishedAt: null
    });
    await api()
      .post("/plans/" + plan.id + "/versions/" + v1.id + "/publish")
      .expect(201);
    await api()
      .post("/plans/" + plan.id + "/versions/" + v1.id + "/publish")
      .expect(201);
    expect((await api(tokenA).get("/plans/catalog").expect(200)).body.items.map(item => item.id)).toContain(plan.id);
    await expect(
      db.query('UPDATE plan_versions SET "monthlyPriceCents"=1 WHERE id=:id', { replacements: { id: v1.id } })
    ).rejects.toThrow();
  });
  it("allows only one open patient contract even during concurrent creation and grants no unpaid access", async () => {
    const input = { planVersionId: v1.id, cadence: "monthly" };
    const results = await Promise.all([
      api(tokenA).post("/memberships/me").send(input),
      api(tokenA).post("/memberships/me").send(input)
    ]);
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    contractA = results.find(result => result.status === 201)!.body;
    expect(contractA).toMatchObject({
      patientId: patientA.id,
      amountCents: 10000,
      status: "pending",
      eligible: false,
      periodsCount: 0
    });
    await api(tokenB)
      .get("/memberships/me/" + contractA.id)
      .expect(404);
    await api(tokenA)
      .get("/memberships/" + contractA.id)
      .expect(403);
    await api(tokenA)
      .post("/memberships/me")
      .send({ ...input, patientId: patientB.id, paidThrough: "2030-01-01" })
      .expect(400);
  });
  it("creates one durable hosted quote and never duplicates an uncertain provider POST", async () => {
    const responses = await Promise.all([
      api(tokenA).post("/memberships/me/" + contractA.id + "/checkout"),
      api(tokenA).post("/memberships/me/" + contractA.id + "/checkout")
    ]);
    expect(responses.every(response => [201, 409].includes(response.status))).toBe(true);
    expect(gateway.checkout).toHaveBeenCalledTimes(1);
    const checkout = (
      await api(tokenA)
        .post("/memberships/me/" + contractA.id + "/checkout")
        .expect(201)
    ).body;
    contractA.checkoutId = checkout.id;
    expect(gateway.checkout).toHaveBeenCalledTimes(1);
    await api(tokenB)
      .post("/memberships/me/" + contractA.id + "/checkout")
      .expect(404);
  });
  it("persists signed events before processing and verifies payment independently of webhook amount", async () => {
    await request(app.getHttpServer())
      .post("/webhooks/recurrente")
      .send({ id: "in_untrusted", event_type: "intent.succeeded" })
      .expect(401);
    payments.set("in_membership_first", {
      id: "in_membership_first",
      amountCents: 10000,
      currency: "GTQ",
      paidAt: new Date(),
      checkoutId: contractA.checkoutId,
      subscriptionId: "su_membership_a",
      membershipId: contractA.id
    });
    await event("in_membership_first").expect(204);
    expect((await api(tokenA).get("/memberships/me/" + contractA.id)).body.eligible).toBe(false);
    await service.drain();
    contractA = (
      await api(tokenA)
        .get("/memberships/me/" + contractA.id)
        .expect(200)
    ).body;
    expect(contractA).toMatchObject({ status: "active", eligible: true, periodsCount: 1, amountCents: 10000 });
    expect(send).not.toHaveBeenCalled();
    const [audit] = await db.query<{ actorType: string; after: object }>(
      'SELECT "actorType","after" FROM audit_events WHERE "resourceId"=:id AND action=:action',
      { replacements: { id: contractA.id, action: "membership.payment-confirmed" }, type: QueryTypes.SELECT }
    );
    expect(audit.actorType).toBe("system");
    expect(JSON.stringify(audit.after)).not.toContain("checkout-session");
  });
  it("deduplicates both transport messages and distinct messages for the same payment", async () => {
    await event("in_membership_first").expect(204);
    await event("in_membership_first", "msg_membership_duplicate").expect(204);
    await Promise.all([service.drain(), service.drain()]);
    const periods = (
      await api(tokenA)
        .get("/memberships/me/" + contractA.id + "/periods")
        .expect(200)
    ).body;
    expect(periods.total).toBe(1);
    expect((await api(tokenA).get("/memberships/me/" + contractA.id)).body.periodsCount).toBe(1);
  });
  it("applies new benefit descriptions to members while preserving contracted prices and renewal history", async () => {
    v2 = (
      await api()
        .post("/plans/" + plan.id + "/versions")
        .send({ ...versionInput, monthlyPriceCents: 20000, benefitDescriptions: ["Descripción actualizada"] })
        .expect(201)
    ).body;
    await api()
      .post("/plans/" + plan.id + "/versions/" + v2.id + "/publish")
      .expect(201);
    const existing = (await api(tokenA).get("/memberships/me/" + contractA.id)).body;
    expect(existing).toMatchObject({
      amountCents: 10000,
      planVersionId: v1.id,
      contractedVersion: { monthlyPriceCents: 10000 },
      currentBenefits: { id: v2.id, benefitDescriptions: ["Descripción actualizada"] }
    });
    payments.set("in_membership_early", {
      id: "in_membership_early",
      amountCents: 10000,
      currency: "GTQ",
      paidAt: new Date(),
      checkoutId: null,
      subscriptionId: "su_membership_a",
      membershipId: null
    });
    await event("in_membership_early").expect(204);
    await service.drain();
    const periods = (await api(tokenA).get("/memberships/me/" + contractA.id + "/periods")).body;
    expect(periods.total).toBe(2);
    expect(periods.items[0].startsAt).toBe(periods.items[1].endsAt);
    expect((await api(tokenA).get("/memberships/me/" + contractA.id)).body.eligible).toBe(true);
    contractB = (
      await api(tokenB).post("/memberships/me").send({ planVersionId: v2.id, cadence: "annual" }).expect(201)
    ).body;
    expect(contractB.amountCents).toBe(200000);
    await api()
      .post("/plans/" + plan.id + "/versions/" + v1.id + "/publish")
      .expect(409);
  });
  it("rolls back period, expiry and notification changes if audit persistence fails, then retries once", async () => {
    const before = (await api(tokenA).get("/memberships/me/" + contractA.id)).body;
    payments.set("in_membership_retry", {
      id: "in_membership_retry",
      amountCents: 10000,
      currency: "GTQ",
      paidAt: new Date(),
      checkoutId: null,
      subscriptionId: "su_membership_a",
      membershipId: null
    });
    await db.query(`CREATE FUNCTION suite_membership_audit_fail() RETURNS trigger LANGUAGE PLPGSQL AS $$
      BEGIN IF NEW."resourceId"='${contractA.id}' AND NEW.action='membership.payment-confirmed'
      THEN RAISE EXCEPTION 'suite failure'; END IF; RETURN NEW; END; $$`);
    await db.query(
      "CREATE TRIGGER suite_membership_audit_fail BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION suite_membership_audit_fail()"
    );
    try {
      await event("in_membership_retry").expect(204);
      await service.drain();
      const unchanged = (await api(tokenA).get("/memberships/me/" + contractA.id)).body;
      expect(unchanged.periodsCount).toBe(before.periodsCount);
      expect(unchanged.paidThrough).toBe(before.paidThrough);
    } finally {
      await db.query("DROP TRIGGER suite_membership_audit_fail ON audit_events");
      await db.query("DROP FUNCTION suite_membership_audit_fail()");
    }
    await db.query("UPDATE recurrente_events SET \"nextAttemptAt\"=NOW() WHERE id='msg_in_membership_retry'");
    await service.drain();
    expect((await api(tokenA).get("/memberships/me/" + contractA.id)).body.periodsCount).toBe(before.periodsCount + 1);
  });
  it("does not let plan deactivation revoke existing paid membership access", async () => {
    await api()
      .patch("/plans/" + plan.id)
      .send({ enabled: false })
      .expect(200);
    expect((await api(tokenA).get("/memberships/me/" + contractA.id)).body.eligible).toBe(true);
    const third = (
      await api().post("/patients").send({ clinicId: clinicA.id, firstName: "Third", lastName: "Patient" }).expect(201)
    ).body;
    await api()
      .post("/memberships")
      .send({ patientId: third.id, planVersionId: v2.id, cadence: "monthly" })
      .expect(409);
    await api()
      .patch("/plans/" + plan.id)
      .send({ enabled: true })
      .expect(200);
  });
  it("retains the paid period after cancellation and durably retries provider billing stop", async () => {
    const before = (await api(tokenA).get("/memberships/me/" + contractA.id)).body;
    const cancelled = (
      await api(tokenA)
        .post("/memberships/me/" + contractA.id + "/cancel")
        .expect(201)
    ).body;
    expect(cancelled.eligible).toBe(true);
    expect(cancelled.paidThrough).toBe(before.paidThrough);
    expect(cancelled.billingSync).toBe("pending");
    gateway.stop.mockRejectedValueOnce(new Error("Provider temporarily unavailable"));
    await service.drain();
    expect((await api(tokenA).get("/memberships/me/" + contractA.id)).body.stoppedAt).toBeNull();
    await db.query('UPDATE membership_billing_jobs SET "nextAttemptAt"=NOW() WHERE "membershipId"=:id', {
      replacements: { id: contractA.id }
    });
    await service.drain();
    const stopped = (await api(tokenA).get("/memberships/me/" + contractA.id)).body;
    expect(stopped.stoppedAt).not.toBeNull();
    expect(stopped.eligible).toBe(true);
    expect(stopped.billingSync).toBe("stopped");
    await api(tokenA).post("/memberships/me").send({ planVersionId: v2.id, cadence: "monthly" }).expect(409);
    expect(gateway.stop).toHaveBeenCalledWith("su_membership_a", false);
  });
  it("suspends an annual membership immediately without extending its paid expiry", async () => {
    contractB.checkoutId = (
      await api(tokenB)
        .post("/memberships/me/" + contractB.id + "/checkout")
        .expect(201)
    ).body.id;
    payments.set("in_membership_annual", {
      id: "in_membership_annual",
      amountCents: 200000,
      currency: "GTQ",
      paidAt: new Date(),
      checkoutId: contractB.checkoutId,
      subscriptionId: "su_membership_b",
      membershipId: contractB.id
    });
    await event("in_membership_annual").expect(204);
    await service.drain();
    const before = (await api(tokenB).get("/memberships/me/" + contractB.id)).body;
    const suspended = (
      await api()
        .post("/memberships/" + contractB.id + "/suspend")
        .expect(201)
    ).body;
    expect(suspended).toMatchObject({ status: "suspended", eligible: false, paidThrough: before.paidThrough });
    await service.drain();
    expect(gateway.stop).toHaveBeenCalledWith("su_membership_b", true);
    expect((await api(tokenB).get("/memberships/me/" + contractB.id)).body.billingSync).toBe("paused");
    await api(tokenB)
      .post("/memberships/" + contractB.id + "/suspend")
      .expect(403);
  });
  it("enforces clinic scope for custom staff without allowing access through a guessed membership ID", async () => {
    await api()
      .post("/roles")
      .send({
        name: "membership-clinic-operator",
        description: "Scoped operator",
        permissions: [
          "memberships:read",
          "memberships:list",
          "memberships:create",
          "memberships:cancel",
          "memberships:suspend"
        ]
      })
      .expect(201);
    const staff = await account("membership-staff@blue.test", ["membership-clinic-operator"]);
    staffToken = staff.token;
    await api()
      .put("/clinics/" + clinicA.id + "/staff/" + staff.user.id)
      .send({ roles: ["customer"] })
      .expect(204);
    await api(staffToken)
      .get("/memberships/" + contractA.id)
      .expect(200);
    await api(staffToken)
      .get("/memberships/" + contractB.id)
      .expect(404);
    await api(staffToken)
      .post("/memberships/" + contractB.id + "/cancel")
      .expect(404);
    const list = (await api(staffToken).get("/memberships").expect(200)).body;
    expect(list.items.map(item => item.id)).toContain(contractA.id);
    expect(list.items.map(item => item.id)).not.toContain(contractB.id);
    await request(app.getHttpServer()).post("/internal/jobs/memberships/dispatch").expect(401);
  });
  it("closes unpaid quotes without a provider and uses current prices for a new contract", async () => {
    const patient = (
      await api().post("/patients").send({ clinicId: clinicA.id, firstName: "New", lastName: "Contract" }).expect(201)
    ).body;
    const first = (
      await api()
        .post("/memberships")
        .send({ patientId: patient.id, planVersionId: v2.id, cadence: "monthly" })
        .expect(201)
    ).body;
    gateway.available.mockReturnValueOnce(false);
    await expect(service.drain()).resolves.toMatchObject({ payments: 0, commands: 0 });
    const closed = (
      await api()
        .post("/memberships/" + first.id + "/cancel")
        .expect(201)
    ).body;
    expect(closed).toMatchObject({ status: "cancelled", eligible: false });
    expect(closed.closedAt).not.toBeNull();
    const next = (
      await api()
        .post("/memberships")
        .send({ patientId: patient.id, planVersionId: v2.id, cadence: "annual" })
        .expect(201)
    ).body;
    expect(next.id).not.toBe(first.id);
    expect(next.amountCents).toBe(200000);
    await expect(
      db.query('UPDATE memberships SET "amountCents"=1 WHERE id=:id', { replacements: { id: next.id } })
    ).rejects.toThrow();
  });
  it("does not retry an ambiguous checkout creation or expose a fabricated payment link", async () => {
    const owner = await ownedContract("membership-uncertain@blue.test"),
      calls = gateway.checkout.mock.calls.length;
    gateway.checkout.mockRejectedValueOnce(new Error("Provider response lost"));
    await api(owner.token)
      .post("/memberships/me/" + owner.contract.id + "/checkout")
      .expect(503);
    await api(owner.token)
      .post("/memberships/me/" + owner.contract.id + "/checkout")
      .expect(409);
    expect(gateway.checkout.mock.calls.length).toBe(calls + 1);
    expect((await api(owner.token).get("/memberships/me/" + owner.contract.id)).body).toMatchObject({
      checkoutStatus: "review",
      checkoutUrl: null,
      eligible: false,
      billingSync: "review"
    });
  });
  it("quarantines mismatched paid amounts and pauses billing without granting a period", async () => {
    const owner = await ownedContract("membership-mismatch@blue.test");
    const checkout = (
      await api(owner.token)
        .post("/memberships/me/" + owner.contract.id + "/checkout")
        .expect(201)
    ).body;
    payments.set("in_membership_wrong_amount", {
      id: "in_membership_wrong_amount",
      amountCents: 1,
      currency: "GTQ",
      paidAt: new Date(),
      checkoutId: checkout.id,
      subscriptionId: "su_membership_wrong_amount",
      membershipId: owner.contract.id
    });
    await event("in_membership_wrong_amount").expect(204);
    await service.drain();
    const state = (await api(owner.token).get("/memberships/me/" + owner.contract.id)).body;
    expect(state).toMatchObject({ eligible: false, periodsCount: 0, billingSync: "review" });
    expect(gateway.stop).toHaveBeenCalledWith("su_membership_wrong_amount", true);
  });
  it("rolls back a payment period when its notification outbox cannot be persisted", async () => {
    const owner = await ownedContract("membership-outbox@blue.test");
    const checkout = (
      await api(owner.token)
        .post("/memberships/me/" + owner.contract.id + "/checkout")
        .expect(201)
    ).body;
    payments.set("in_membership_outbox", {
      id: "in_membership_outbox",
      amountCents: 20000,
      currency: "GTQ",
      paidAt: new Date(),
      checkoutId: checkout.id,
      subscriptionId: "su_membership_outbox",
      membershipId: owner.contract.id
    });
    await db.query(`CREATE FUNCTION suite_membership_mail_fail() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
      IF EXISTS(SELECT 1 FROM notifications WHERE id=NEW."notificationId" AND "userId"='${owner.user.id}')
      THEN RAISE EXCEPTION 'suite outbox failure'; END IF; RETURN NEW; END; $$`);
    await db.query(
      "CREATE TRIGGER suite_membership_mail_fail BEFORE INSERT ON notification_deliveries FOR EACH ROW EXECUTE FUNCTION suite_membership_mail_fail()"
    );
    try {
      await event("in_membership_outbox").expect(204);
      await service.drain();
      expect((await api(owner.token).get("/memberships/me/" + owner.contract.id)).body).toMatchObject({
        periodsCount: 0,
        eligible: false
      });
      const [count] = await db.query<{ total: number }>(
        'SELECT COUNT(*)::int total FROM membership_periods WHERE "membershipId"=:id',
        { replacements: { id: owner.contract.id }, type: QueryTypes.SELECT }
      );
      expect(count.total).toBe(0);
    } finally {
      await db.query("DROP TRIGGER suite_membership_mail_fail ON notification_deliveries");
      await db.query("DROP FUNCTION suite_membership_mail_fail()");
    }
    await db.query("UPDATE recurrente_events SET \"nextAttemptAt\"=NOW() WHERE id='msg_in_membership_outbox'");
    await service.drain();
    expect((await api(owner.token).get("/memberships/me/" + owner.contract.id)).body).toMatchObject({
      periodsCount: 1,
      eligible: true
    });
  });
  it("protects contractual history from update, delete and truncate operations", async () => {
    await expect(
      db.query('DELETE FROM membership_periods WHERE "membershipId"=:id', { replacements: { id: contractA.id } })
    ).rejects.toThrow();
    await expect(db.query("TRUNCATE membership_periods")).rejects.toThrow();
    await expect(db.query("TRUNCATE plan_versions CASCADE")).rejects.toThrow();
    expect((await api(tokenA).get("/memberships/me/" + contractA.id + "/periods")).body.total).toBe(3);
  });
  it("preserves paid coverage if cancellation happens before its webhook is processed", async () => {
    const owner = await ownedContract("membership-paid-cancelled@blue.test");
    const checkout = (
      await api(owner.token)
        .post("/memberships/me/" + owner.contract.id + "/checkout")
        .expect(201)
    ).body;
    payments.set("in_membership_paid_cancelled", {
      id: "in_membership_paid_cancelled",
      amountCents: 20000,
      currency: "GTQ",
      paidAt: new Date(Date.now() - 5),
      checkoutId: checkout.id,
      subscriptionId: "su_membership_paid_cancelled",
      membershipId: owner.contract.id
    });
    await api(owner.token)
      .post("/memberships/me/" + owner.contract.id + "/cancel")
      .expect(201);
    await event("in_membership_paid_cancelled").expect(204);
    await service.drain();
    const state = (await api(owner.token).get("/memberships/me/" + owner.contract.id)).body;
    expect(state).toMatchObject({ status: "active", eligible: true, periodsCount: 1, billingSync: "stopped" });
    expect(state.cancelRequestedAt).not.toBeNull();
  });
  it("recovers a missing webhook before confirming stop for a paid checkout", async () => {
    const owner = await ownedContract("membership-lost-hook@blue.test");
    const checkout = (
      await api(owner.token)
        .post("/memberships/me/" + owner.contract.id + "/checkout")
        .expect(201)
    ).body;
    payments.set("in_membership_lost_hook", {
      id: "in_membership_lost_hook",
      amountCents: 20000,
      currency: "GTQ",
      paidAt: new Date(Date.now() - 5),
      checkoutId: checkout.id,
      subscriptionId: "su_membership_lost_hook",
      membershipId: owner.contract.id
    });
    await api(owner.token)
      .post("/memberships/me/" + owner.contract.id + "/cancel")
      .expect(201);
    gateway.checkoutState.mockResolvedValueOnce({ expiredUnpaid: false, paymentId: "in_membership_lost_hook" });
    await service.drain();
    expect((await api(owner.token).get("/memberships/me/" + owner.contract.id)).body.stoppedAt).toBeNull();
    await db.query('UPDATE membership_billing_jobs SET "nextAttemptAt"=NOW() WHERE "membershipId"=:id', {
      replacements: { id: owner.contract.id }
    });
    await service.drain();
    expect((await api(owner.token).get("/memberships/me/" + owner.contract.id)).body).toMatchObject({
      eligible: true,
      periodsCount: 1,
      billingSync: "stopped"
    });
  });
  it("closes an expired unpaid checkout only after provider confirmation", async () => {
    const owner = await ownedContract("membership-expired-quote@blue.test");
    await api(owner.token)
      .post("/memberships/me/" + owner.contract.id + "/checkout")
      .expect(201);
    await api(owner.token)
      .post("/memberships/me/" + owner.contract.id + "/cancel")
      .expect(201);
    gateway.checkoutState.mockResolvedValueOnce({ expiredUnpaid: true, paymentId: null });
    await service.drain();
    const state = (await api(owner.token).get("/memberships/me/" + owner.contract.id)).body;
    expect(state).toMatchObject({ status: "cancelled", eligible: false, billingSync: "stopped" });
    expect(state.closedAt).not.toBeNull();
    await api(owner.token).post("/memberships/me").send({ planVersionId: v2.id, cadence: "annual" }).expect(201);
  });
});
