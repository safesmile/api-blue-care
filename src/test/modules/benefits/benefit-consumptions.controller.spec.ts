import request from "supertest";
import { BenefitConsumptionsController } from "../../../modules/benefits/presentation/benefit-consumptions.controller";
import { BenefitOperationsUseCase } from "../../helpers/usecases/BenefitOperationsUseCase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("BenefitConsumptionsController", () => {
  const service = {
    family: jest.fn(),
    addBeneficiary: jest.fn(),
    replaceBeneficiary: jest.fn(),
    balances: jest.fn(),
    history: jest.fn(),
    clinicHistory: jest.fn(),
    consume: jest.fn(),
    consumeTicket: jest.fn(),
    reverse: jest.fn()
  };
  const actor = userFixture().toView(),
    id = "ba50a6d7-3ec5-4fb0-9145-2febbfaf8de8",
    base = "/benefits/memberships/" + id;
  const input = {
      membershipId: id,
      benefitId: id,
      clinicId: id,
      units: 1,
      serviceReference: "receipt",
      idempotencyKey: id
    },
    family = { firstName: "Relative", lastName: "Example" };
  let app;
  beforeAll(async () => {
    app = await controllerApp(BenefitConsumptionsController, [...BenefitOperationsUseCase.providers(service)], actor);
  });
  afterAll(async () => {
    await app.close();
  });
  it("forwards explicit clinic, patient and correction operations to the service", async () => {
    await request(app.getHttpServer()).post("/benefits/consumptions").send(input).expect(201);
    const ticket = { token: "a".repeat(80), clinicId: id, serviceReference: "receipt", idempotencyKey: id };
    await request(app.getHttpServer()).post("/benefits/tickets/consume").send(ticket).expect(201);
    await request(app.getHttpServer())
      .post("/benefits/consumptions/" + id + "/reverse")
      .send({ reason: "Correction", idempotencyKey: id })
      .expect(201);
    await request(app.getHttpServer())
      .get("/benefits/clinics/" + id + "/history")
      .expect(200);
    await request(app.getHttpServer())
      .get(base + "/balances")
      .expect(200);
    await request(app.getHttpServer())
      .get(base + "/history")
      .expect(200);
    await request(app.getHttpServer())
      .get(base + "/family")
      .expect(200);
    await request(app.getHttpServer())
      .post(base + "/family")
      .send(family)
      .expect(201);
    await request(app.getHttpServer())
      .post(base + "/family/" + id + "/replace")
      .send(family)
      .expect(201);
    expect(service.consume).toHaveBeenCalledWith(input, actor);
    expect(service.consumeTicket).toHaveBeenCalledWith(ticket, actor);
    expect(service.reverse).toHaveBeenCalledWith(id, "Correction", id, actor);
    expect(service.replaceBeneficiary).toHaveBeenCalledWith(id, id, family, actor);
  });
  it("requires a reason and rejects timestamp/actor overrides or unbound ticket fields", async () => {
    await request(app.getHttpServer())
      .post("/benefits/consumptions/" + id + "/reverse")
      .send({ idempotencyKey: id })
      .expect(400);
    await request(app.getHttpServer())
      .post("/benefits/consumptions/" + id + "/reverse")
      .send({ idempotencyKey: id, reason: " " })
      .expect(400);
    for (const extra of [
      { occurredAt: "2026-01-01" },
      { performedBy: id },
      { windowStart: "2026-01-01" },
      { limitSnapshot: 100 }
    ])
      await request(app.getHttpServer())
        .post("/benefits/consumptions")
        .send({ ...input, ...extra })
        .expect(400);
    await request(app.getHttpServer())
      .post("/benefits/tickets/consume")
      .send({ token: "a".repeat(80), clinicId: id, serviceReference: "receipt", idempotencyKey: id, units: 2 })
      .expect(400);
    await request(app.getHttpServer()).get("/benefits/clinics/invalid/history").expect(400);
  });
});
