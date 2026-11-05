import { Test } from "@nestjs/testing";
import { ValidationPipe } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";
import { randomUUID, createHash } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../app.module";
import { createSuperUser } from "../../../scripts/lib/super-user";
import { AuthUseCase } from "../../modules/auth/application/auth.usecase";
import { AccountActionsUseCase } from "../../modules/auth/application/account-actions.usecase";
import { AccountMailer } from "../../modules/auth/domain/account-actions.repository";
import { EmailSender } from "../../shared/domain/email-sender";
import {
  MembershipGateway,
  MembershipBilling,
  type VerifiedPayment
} from "../../modules/memberships/domain/membership-billing";
import { MembershipsUseCase } from "../../modules/memberships/application/memberships.usecase";
import { BenefitContext } from "../../modules/benefits/infrastructure/benefit-context";
import { periodEnd } from "../../modules/memberships/domain/membership-state";

describe("Atomic global benefits and individual family quota (disposable PostgreSQL)", () => {
  let app,
    db: Sequelize,
    rootToken: string,
    staffA,
    staffB,
    owner,
    other,
    plan,
    version,
    clinicA,
    clinicB,
    holder,
    familyBenefit,
    item,
    annual,
    reliable,
    firstConsumption;
  let businessNow: Date, clock: jest.SpyInstance;
  const relatives: any[] = [],
    mail: { email: string; kind: string; token: string }[] = [],
    payments = new Map<string, VerifiedPayment>();
  const password = "Abcd123!",
    send = jest.fn();
  const gateway = {
    available: () => true,
    checkout: jest.fn(async () => {
      const id = "ch_" + randomUUID().replace(/-/g, "");
      return { id, url: "https://app.recurrente.com/checkout-session/" + id };
    }),
    payment: async (id: string) => payments.get(id) ?? null,
    checkoutState: jest.fn().mockResolvedValue({ expiredUnpaid: false, paymentId: null }),
    stop: jest.fn().mockResolvedValue(undefined),
    verify: jest.fn()
  };
  const api = (token = rootToken) => ({
    get: (path: string) => request(app.getHttpServer()).get(path).auth(token, { type: "bearer" }),
    post: (path: string) => request(app.getHttpServer()).post(path).auth(token, { type: "bearer" }),
    put: (path: string) => request(app.getHttpServer()).put(path).auth(token, { type: "bearer" }),
    patch: (path: string) => request(app.getHttpServer()).patch(path).auth(token, { type: "bearer" })
  });
  const account = async (email: string, roles: string[]) => {
    const user = (
      await api().post("/users").send({ email, firstName: "Benefit", lastName: "User", password, roles }).expect(201)
    ).body;
    await app.get(AccountActionsUseCase).requestActivation(email);
    await app
      .get(AccountActionsUseCase)
      .redeem("activate", mail.findLast(entry => entry.email === email && entry.kind === "activate")!.token, password);
    const session = await app.get(AuthUseCase).login(email, password);
    return { user, token: session.token };
  };
  const paidOwner = async (email: string, clinicId: string, periods: number) => {
    const value = await account(email, ["customer"]);
    const patient = (
      await api().post("/patients").send({ clinicId, firstName: "Holder", lastName: "Patient", email }).expect(201)
    ).body;
    await api()
      .post("/patients/" + patient.id + "/account")
      .send({ userId: value.user.id })
      .expect(201);
    const member = (
      await api(value.token).post("/memberships/me").send({ planVersionId: version.id, cadence: "annual" }).expect(201)
    ).body;
    const checkout = (
      await api(value.token)
        .post("/memberships/me/" + member.id + "/checkout")
        .expect(201)
    ).body;
    const subscriptionId = "su_" + randomUUID().replace(/-/g, "");
    for (let i = 0; i < periods; i++) {
      const id = "in_" + randomUUID().replace(/-/g, "");
      payments.set(id, {
        id,
        amountCents: member.amountCents,
        currency: "GTQ",
        paidAt: new Date(),
        checkoutId: checkout.id,
        subscriptionId,
        membershipId: member.id
      });
      await app.get(MembershipBilling).receive({ id: "msg_" + id, resourceId: id, eventType: "intent.succeeded" });
      await app.get(MembershipsUseCase).drain();
    }
    const membership = (
      await api(value.token)
        .get("/memberships/me/" + member.id)
        .expect(200)
    ).body;
    return { ...value, patient, membership };
  };
  const publish = async (benefitId: string, limitUnits: number, enabled = true, discountBasisPoints?: number) => {
    const revision = (
      await api()
        .post("/benefits/" + benefitId + "/versions")
        .send({
          name: "Test benefit",
          description: "Test rule, not commercial configuration",
          limitUnits,
          enabled,
          discountBasisPoints
        })
        .expect(201)
    ).body;
    await api()
      .post("/benefits/" + benefitId + "/versions/" + revision.id + "/publish")
      .expect(201);
    return revision;
  };
  const createBenefit = async (code: string, kind: string, period: string, audience: string) =>
    (await api().post("/benefits").send({ planId: plan.id, code, kind, period, audience }).expect(201)).body;
  const balance = async (benefitId: string, beneficiaryId?: string) => {
    const response = await api(owner.token)
      .get(
        "/benefits/me/" + owner.membership.id + "/balances" + (beneficiaryId ? "?beneficiaryId=" + beneficiaryId : "")
      )
      .expect(200);
    return response.body.items.find(entry => entry.benefit.id === benefitId);
  };
  const consumption = (benefitId: string, clinicId: string, extra: Record<string, unknown> = {}) => ({
    membershipId: owner.membership.id,
    benefitId,
    clinicId,
    units: 1,
    serviceReference: "receipt_" + randomUUID(),
    idempotencyKey: randomUUID(),
    ...extra
  });
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
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, "127.0.0.1");
    db = app.get(Sequelize);
    await createSuperUser(db, {
      firstName: "Benefit",
      lastName: "Operator",
      email: "benefit-root@blue.test",
      password
    });
    rootToken = (await app.get(AuthUseCase).login("benefit-root@blue.test", password)).token;
    clinicA = (await api().post("/clinics").send({ code: "benefit-north", name: "Benefit north" }).expect(201)).body;
    clinicB = (await api().post("/clinics").send({ code: "benefit-south", name: "Benefit south" }).expect(201)).body;
    plan = (await api().post("/plans").send({ code: "benefit-blue-care-plus" }).expect(201)).body;
    version = (
      await api()
        .post("/plans/" + plan.id + "/versions")
        .send({
          name: "Blue Care +",
          description: "Test plan",
          benefitDescriptions: [],
          monthlyPriceCents: 10000,
          taxDisclosure: "Fixture total only"
        })
        .expect(201)
    ).body;
    await api()
      .post("/plans/" + plan.id + "/versions/" + version.id + "/publish")
      .expect(201);
    owner = await paidOwner("benefit-owner@blue.test", clinicA.id, 2);
    other = await paidOwner("benefit-other@blue.test", clinicB.id, 1);
    await api()
      .post("/roles")
      .send({
        name: "benefit-clinic-operator",
        description: "Scoped benefit staff",
        permissions: [
          "benefits:consume",
          "benefits:reverse",
          "benefits:history",
          "benefits:balances",
          "benefits:family-manage"
        ]
      })
      .expect(201);
    staffA = await account("benefit-staff-a@blue.test", ["benefit-clinic-operator"]);
    staffB = await account("benefit-staff-b@blue.test", ["benefit-clinic-operator"]);
    await api()
      .put("/clinics/" + clinicA.id + "/staff/" + staffA.user.id)
      .expect(204);
    await api()
      .put("/clinics/" + clinicB.id + "/staff/" + staffB.user.id)
      .expect(204);
    businessNow = new Date();
    clock = jest.spyOn(app.get(BenefitContext), "now").mockImplementation(async () => businessNow);
  }, 30000);
  afterAll(async () => {
    clock?.mockRestore();
    if (app) await app.close();
  });
  it("publishes rules independently of contracted prices and validates stable dimensions", async () => {
    holder = await createBenefit("holder-cleaning", "service", "monthly", "holder");
    await publish(holder.id, 1);
    familyBenefit = await createBenefit("family-cleaning", "discount", "monthly", "beneficiaries");
    await publish(familyBenefit.id, 1, true, 1500);
    item = await createBenefit("test-item", "item", "contract", "holder");
    await publish(item.id, 1);
    annual = await createBenefit("annual-service", "service", "annual", "holder");
    await publish(annual.id, 1);
    reliable = await createBenefit("reliable-service", "service", "monthly", "holder");
    await publish(reliable.id, 1);
    await api()
      .post("/benefits")
      .send({ planId: plan.id, code: "holder-cleaning", kind: "service", period: "monthly", audience: "holder" })
      .expect(409);
    await api()
      .post("/benefits/" + holder.id + "/versions")
      .send({ name: "Wrong", description: "Wrong", limitUnits: 1, enabled: true, discountBasisPoints: 1500 })
      .expect(400);
    expect((await balance(holder.id)).remainingUnits).toBe(1);
    await api(owner.token).get("/benefits").expect(403);
    await api(owner.token).post("/benefits/consumptions").send(consumption(holder.id, clinicA.id)).expect(403);
  });
  it("allows exactly one winner when twelve requests from different clinics compete for the last global unit", async () => {
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        api()
          .post("/benefits/consumptions")
          .send(consumption(holder.id, i % 2 ? clinicA.id : clinicB.id))
      )
    );
    expect(responses.filter(response => response.status === 201)).toHaveLength(1);
    expect(responses.filter(response => response.status === 409)).toHaveLength(11);
    firstConsumption = responses.find(response => response.status === 201)!.body;
    expect(await balance(holder.id)).toMatchObject({ usedUnits: 1, remainingUnits: 0 });
    const [count] = await db.query<{ total: number }>(
      'SELECT COUNT(*)::int total FROM benefit_consumptions WHERE "membershipId"=:id AND "benefitId"=:benefitId',
      { replacements: { id: owner.membership.id, benefitId: holder.id }, type: QueryTypes.SELECT }
    );
    expect(count.total).toBe(1);
  });
  it("returns the original result for identical retries and rejects key reuse with other data", async () => {
    const payload = {
      membershipId: firstConsumption.membershipId,
      benefitId: firstConsumption.benefitId,
      clinicId: firstConsumption.clinicId,
      units: firstConsumption.units,
      serviceReference: firstConsumption.serviceReference,
      idempotencyKey: firstConsumption.idempotencyKey
    };
    expect((await api().post("/benefits/consumptions").send(payload).expect(201)).body.id).toBe(firstConsumption.id);
    await api()
      .post("/benefits/consumptions")
      .send({ ...payload, units: 2 })
      .expect(409);
    expect((await balance(holder.id)).usedUnits).toBe(1);
  });
  it("preserves current usage when revised limits increase, decrease or disable a benefit", async () => {
    const raised = await publish(holder.id, 3);
    expect(await balance(holder.id)).toMatchObject({ usedUnits: 1, remainingUnits: 2 });
    const record = (
      await api()
        .post("/benefits/consumptions")
        .send(consumption(holder.id, clinicA.id, { units: 2 }))
        .expect(201)
    ).body;
    expect(record).toMatchObject({ benefitVersionId: raised.id, limitSnapshot: 3, units: 2 });
    await publish(holder.id, 2);
    expect(await balance(holder.id)).toMatchObject({ usedUnits: 3, remainingUnits: 0 });
    await api().post("/benefits/consumptions").send(consumption(holder.id, clinicB.id)).expect(409);
    await publish(holder.id, 2, false);
    expect((await balance(holder.id)).remainingUnits).toBe(0);
    await publish(holder.id, 2);
    const history = (
      await api(owner.token)
        .get("/benefits/me/" + owner.membership.id + "/history")
        .expect(200)
    ).body;
    expect(history.items.find(entry => entry.id === firstConsumption.id).limitSnapshot).toBe(1);
  });
  it("keeps the rule snapshot consistent when publication competes with consumption", async () => {
    const benefit = await createBenefit("publication-race", "service", "monthly", "holder");
    const previous = await publish(benefit.id, 2);
    const next = (
      await api()
        .post("/benefits/" + benefit.id + "/versions")
        .send({
          name: "Lower concurrent limit",
          description: "Concurrent publication fixture",
          limitUnits: 1,
          enabled: true
        })
        .expect(201)
    ).body;
    const [publication, redemption] = await Promise.all([
      api().post("/benefits/" + benefit.id + "/versions/" + next.id + "/publish"),
      api()
        .post("/benefits/consumptions")
        .send(consumption(benefit.id, clinicA.id, { units: 2 }))
    ]);
    expect(publication.status).toBe(201);
    expect([201, 409]).toContain(redemption.status);
    if (redemption.status === 201) {
      expect(redemption.body.benefitVersionId).toBe(previous.id);
      expect(redemption.body.limitSnapshot).toBe(2);
    }
    const current = await balance(benefit.id);
    expect(current.remainingUnits).toBe(redemption.status === 201 ? 0 : 1);
  });

  it("registers four additional family members without accounts and enforces the annual replacement lock", async () => {
    for (let i = 0; i < 4; i++)
      relatives.push(
        (
          await api(owner.token)
            .post("/benefits/me/" + owner.membership.id + "/family")
            .send({ firstName: "Relative" + i, lastName: "Family", birthDate: i === 0 ? "2010-01-01" : undefined })
            .expect(201)
        ).body
      );
    await api(owner.token)
      .post("/benefits/me/" + owner.membership.id + "/family")
      .send({ firstName: "Extra", lastName: "Family" })
      .expect(409);
    await api(owner.token)
      .post("/benefits/me/" + owner.membership.id + "/family/" + relatives[0].id + "/replace")
      .send({ firstName: "New", lastName: "Person" })
      .expect(409);
    await api(other.token)
      .get("/benefits/me/" + owner.membership.id + "/family")
      .expect(404);
    await api()
      .put("/benefits/plans/" + plan.id + "/family-settings")
      .send({ maxBeneficiaries: 2 })
      .expect(200);
    expect((await api(owner.token).get("/benefits/me/" + owner.membership.id + "/family")).body.total).toBe(4);
    await api()
      .put("/benefits/plans/" + plan.id + "/family-settings")
      .send({ maxBeneficiaries: 4 })
      .expect(200);
  });
  it("uses an independent quota per family member while sharing each quota across all clinics", async () => {
    await api()
      .post("/benefits/consumptions")
      .send(consumption(familyBenefit.id, clinicA.id, { beneficiaryId: relatives[0].id }))
      .expect(201);
    await api()
      .post("/benefits/consumptions")
      .send(consumption(familyBenefit.id, clinicB.id, { beneficiaryId: relatives[0].id }))
      .expect(409);
    await api()
      .post("/benefits/consumptions")
      .send(consumption(familyBenefit.id, clinicB.id, { beneficiaryId: relatives[1].id }))
      .expect(201);
    expect(await balance(familyBenefit.id, relatives[0].id)).toMatchObject({ usedUnits: 1, remainingUnits: 0 });
    expect(await balance(familyBenefit.id, relatives[2].id)).toMatchObject({ usedUnits: 0, remainingUnits: 1 });
    expect((await balance(familyBenefit.id)).recipientEligible).toBe(false);
    await publish(familyBenefit.id, 1, true, 2000);
    expect(await balance(familyBenefit.id, relatives[0].id)).toMatchObject({ usedUnits: 1, remainingUnits: 0 });
  });
  it("accepts a patient-presented ticket in another assigned clinic without exposing unrestricted patient data", async () => {
    await api(staffB.token)
      .get("/benefits/memberships/" + owner.membership.id + "/history")
      .expect(404);
    await api(staffB.token)
      .post("/benefits/consumptions")
      .send(consumption(familyBenefit.id, clinicB.id, { beneficiaryId: relatives[2].id }))
      .expect(404);
    const ticket = (
      await api(owner.token)
        .post("/benefits/me/" + owner.membership.id + "/tickets")
        .send({ benefitId: familyBenefit.id, beneficiaryId: relatives[2].id, units: 1 })
        .expect("Cache-Control", "no-store")
        .expect(201)
    ).body;
    const payload = {
      token: ticket.token,
      clinicId: clinicB.id,
      serviceReference: "presented-service",
      idempotencyKey: randomUUID()
    };
    await api(staffA.token).post("/benefits/tickets/consume").send(payload).expect(403);
    const claim = (await api(staffB.token).post("/benefits/tickets/consume").send(payload).expect(201)).body;
    expect(claim).toMatchObject({
      performedBy: staffB.user.id,
      actorName: "Benefit User",
      clinicId: clinicB.id,
      recipientName: "Relative2 Family",
      units: 1,
      discountBasisPoints: 2000
    });
    expect((await api(staffB.token).post("/benefits/tickets/consume").send(payload).expect(201)).body.id).toBe(
      claim.id
    );
    await api(staffB.token)
      .post("/benefits/tickets/consume")
      .send({ ...payload, idempotencyKey: randomUUID(), serviceReference: "replayed" })
      .expect(409);
    expect(
      (
        await api(staffB.token)
          .get("/benefits/clinics/" + clinicB.id + "/history")
          .expect(200)
      ).body.items.some(entry => entry.id === claim.id)
    ).toBe(true);
    await api(staffB.token)
      .get("/benefits/clinics/" + clinicA.id + "/history")
      .expect(403);
    const [stored] = await db.query<{ tokenHash: string }>('SELECT "tokenHash" FROM benefit_tickets WHERE id=:id', {
      replacements: { id: ticket.id },
      type: QueryTypes.SELECT
    });
    expect(stored.tokenHash).toBe(createHash("sha256").update(ticket.token).digest("hex"));
    const events = await db.query<{ after: unknown }>(
      'SELECT "after" FROM audit_events WHERE "resourceId" IN (:id,:claimId)',
      { replacements: { id: owner.membership.id, claimId: claim.id }, type: QueryTypes.SELECT }
    );
    expect(JSON.stringify(events)).not.toContain(ticket.token);
  });
  it("rolls back ledger, ticket use and audit if its durable notification cannot be inserted", async () => {
    const ticket = (
      await api(owner.token)
        .post("/benefits/me/" + owner.membership.id + "/tickets")
        .send({ benefitId: reliable.id, units: 1 })
        .expect(201)
    ).body;
    const payload = {
      token: ticket.token,
      clinicId: clinicA.id,
      serviceReference: "rollback-service",
      idempotencyKey: randomUUID()
    };
    await db.query(`CREATE FUNCTION suite_benefit_notify_fail() RETURNS trigger LANGUAGE PLPGSQL AS $$ BEGIN
      IF NEW."userId"='${owner.user.id}' THEN RAISE EXCEPTION 'suite notification failure'; END IF; RETURN NEW; END; $$`);
    await db.query(
      "CREATE TRIGGER suite_benefit_notify_fail BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION suite_benefit_notify_fail()"
    );
    try {
      await api(staffA.token).post("/benefits/tickets/consume").send(payload).expect(500);
      expect(await balance(reliable.id)).toMatchObject({ usedUnits: 0, remainingUnits: 1 });
      const [stored] = await db.query<{ consumedAt: Date | null }>(
        'SELECT "consumedAt" FROM benefit_tickets WHERE id=:id',
        { replacements: { id: ticket.id }, type: QueryTypes.SELECT }
      );
      expect(stored.consumedAt).toBeNull();
    } finally {
      await db.query("DROP TRIGGER suite_benefit_notify_fail ON notifications");
      await db.query("DROP FUNCTION suite_benefit_notify_fail()");
    }
    await api(staffA.token).post("/benefits/tickets/consume").send(payload).expect(201);
    expect((await balance(reliable.id)).usedUnits).toBe(1);
  });
  it("rejects expired presentation without consuming its quota", async () => {
    await publish(reliable.id, 2);
    await api(staffA.token)
      .post("/benefits/consumptions")
      .send(consumption(reliable.id, clinicA.id, { serviceReference: "rollback-service" }))
      .expect(409);
    const previous = (await api(owner.token).get("/benefits/me/" + owner.membership.id + "/history")).body.items.find(
      entry => entry.serviceReference === "rollback-service"
    );
    await api(staffA.token)
      .post("/benefits/consumptions/" + previous.id + "/reverse")
      .send({ reason: "Correct service entry", idempotencyKey: randomUUID() })
      .expect(201);
    await api(staffA.token)
      .post("/benefits/consumptions")
      .send(consumption(reliable.id, clinicA.id, { serviceReference: "rollback-service" }))
      .expect(201);
    expect(await balance(reliable.id)).toMatchObject({ usedUnits: 1, remainingUnits: 1 });
    const ticket = (
      await api(owner.token)
        .post("/benefits/me/" + owner.membership.id + "/tickets")
        .send({ benefitId: familyBenefit.id, beneficiaryId: relatives[3].id, units: 1 })
        .expect(201)
    ).body;
    businessNow = new Date(new Date(ticket.expiresAt).getTime() + 1);
    await api(staffA.token)
      .post("/benefits/tickets/consume")
      .send({
        token: ticket.token,
        clinicId: clinicA.id,
        serviceReference: "expired-ticket",
        idempotencyKey: randomUUID()
      })
      .expect(409);
    expect(await balance(familyBenefit.id, relatives[3].id)).toMatchObject({ usedUnits: 0, remainingUnits: 1 });
  });
  it("resets monthly quotas for an annual member without accumulating unused units", async () => {
    await api().post("/benefits/consumptions").send(consumption(item.id, clinicA.id)).expect(201);
    await api().post("/benefits/consumptions").send(consumption(annual.id, clinicA.id)).expect(201);
    businessNow = periodEnd(new Date(owner.membership.anchorAt), 1, "monthly");
    expect(await balance(holder.id)).toMatchObject({ usedUnits: 0, remainingUnits: 2 });
    expect(await balance(familyBenefit.id, relatives[0].id)).toMatchObject({ usedUnits: 0, remainingUnits: 1 });
    expect(await balance(familyBenefit.id, relatives[3].id)).toMatchObject({ usedUnits: 0, remainingUnits: 1 });
    expect(await balance(item.id)).toMatchObject({ usedUnits: 1, remainingUnits: 0 });
    expect(await balance(annual.id)).toMatchObject({ usedUnits: 1, remainingUnits: 0 });
  });
  it("returns corrected quota only to its original period and serializes simultaneous reversals", async () => {
    await api()
      .post("/benefits/consumptions")
      .send(consumption(holder.id, clinicA.id, { units: 2 }))
      .expect(201);
    const results = await Promise.all([
      api()
        .post("/benefits/consumptions/" + firstConsumption.id + "/reverse")
        .send({ reason: "Recorded by mistake", idempotencyKey: randomUUID() }),
      api()
        .post("/benefits/consumptions/" + firstConsumption.id + "/reverse")
        .send({ reason: "Duplicate correction", idempotencyKey: randomUUID() })
    ]);
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    expect(await balance(holder.id)).toMatchObject({ usedUnits: 2, remainingUnits: 0 });
    const reversal = results.find(result => result.status === 201)!.body;
    expect(
      (
        await api()
          .post("/benefits/consumptions/" + firstConsumption.id + "/reverse")
          .send({ reason: reversal.reason, idempotencyKey: reversal.idempotencyKey })
          .expect(201)
      ).body.id
    ).toBe(reversal.id);
    await api(owner.token)
      .post("/benefits/consumptions/" + firstConsumption.id + "/reverse")
      .send({ reason: "Not authorized", idempotencyKey: randomUUID() })
      .expect(403);
    await api()
      .post("/benefits/consumptions/" + firstConsumption.id + "/reverse")
      .send({ idempotencyKey: randomUUID() })
      .expect(400);
  });
  it("replaces after one year without rewriting old beneficiaries or consumption snapshots", async () => {
    businessNow = new Date(relatives[0].lockedUntil);
    const replacement = (
      await api(owner.token)
        .post("/benefits/me/" + owner.membership.id + "/family/" + relatives[0].id + "/replace")
        .send({ firstName: "New", lastName: "Relative" })
        .expect(201)
    ).body;
    expect(replacement.id).not.toBe(relatives[0].id);
    expect(replacement.slotId).toBe(relatives[0].slotId);
    expect(await balance(familyBenefit.id, relatives[0].id)).toMatchObject({
      recipientEligible: false,
      remainingUnits: 0
    });
    expect((await balance(familyBenefit.id, replacement.id)).remainingUnits).toBe(1);
    await api(owner.token)
      .post("/benefits/me/" + owner.membership.id + "/family/" + replacement.id + "/replace")
      .send({ firstName: "Another", lastName: "Relative" })
      .expect(409);
    const history = (await api(owner.token).get("/benefits/me/" + owner.membership.id + "/history")).body;
    expect(
      history.items.some(entry => entry.beneficiaryId === relatives[0].id && entry.recipientName === "Relative0 Family")
    ).toBe(true);
    expect((await balance(annual.id)).remainingUnits).toBe(1);
  });
  it("blocks suspended, inactive-patient and expired memberships without trusting supplied balances", async () => {
    await api()
      .post("/memberships/" + other.membership.id + "/suspend")
      .expect(201);
    await api()
      .post("/benefits/consumptions")
      .send({ ...consumption(holder.id, clinicB.id), membershipId: other.membership.id })
      .expect(409);
    await api()
      .patch("/patients/" + owner.patient.id)
      .send({ enabled: false })
      .expect(200);
    await api()
      .post("/benefits/consumptions")
      .send(consumption(familyBenefit.id, clinicA.id, { beneficiaryId: relatives[1].id }))
      .expect(409);
    await api()
      .patch("/patients/" + owner.patient.id)
      .send({ enabled: true })
      .expect(200);
    await api(owner.token)
      .post("/memberships/me/" + owner.membership.id + "/cancel")
      .expect(201);
    expect((await balance(familyBenefit.id, relatives[1].id)).remainingUnits).toBe(1);
    businessNow = new Date(owner.membership.paidThrough);
    expect(await balance(familyBenefit.id, relatives[1].id)).toMatchObject({
      membershipEligible: false,
      remainingUnits: 0
    });
    await api(owner.token)
      .post("/benefits/me/" + owner.membership.id + "/tickets")
      .send({ benefitId: familyBenefit.id, beneficiaryId: relatives[1].id, units: 1 })
      .expect(409);
  });
  it("protects history against mutation and does not send clinical data or real email", async () => {
    await expect(
      db.query("UPDATE benefit_consumptions SET units=100 WHERE id=:id", { replacements: { id: firstConsumption.id } })
    ).rejects.toThrow();
    await expect(db.query("TRUNCATE benefit_consumptions CASCADE")).rejects.toThrow();
    await expect(db.query("TRUNCATE benefit_versions CASCADE")).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .delete("/users/" + staffB.user.id)
      .auth(rootToken, { type: "bearer" })
      .expect(200);
    const records = await db.query<{ actorName: string }>(
      'SELECT "actorName" FROM benefit_consumptions WHERE "performedBy"=:id',
      { replacements: { id: staffB.user.id }, type: QueryTypes.SELECT }
    );
    expect(records.length).toBeGreaterThan(0);
    expect(records[0].actorName).toBe("Benefit User");
  });
});
