import request from "supertest";
import { BenefitAccountsController } from "../../../modules/benefits/presentation/benefit-accounts.controller";
import { BenefitOperationsUseCase } from "../../helpers/usecases/BenefitOperationsUseCase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("BenefitAccountsController", () => {
  const service = {
    family: jest.fn(),
    addBeneficiary: jest.fn(),
    replaceBeneficiary: jest.fn(),
    balances: jest.fn(),
    issueTicket: jest.fn(),
    history: jest.fn()
  };
  const actor = userFixture().toView(),
    id = "ba50a6d7-3ec5-4fb0-9145-2febbfaf8de8",
    base = "/benefits/me/" + id;
  const input = { firstName: "Relative", lastName: "Example" };
  let app;
  beforeAll(async () => {
    app = await controllerApp(BenefitAccountsController, [...BenefitOperationsUseCase.providers(service)], actor);
  });
  afterAll(async () => {
    await app.close();
  });
  it("always selects owner scope and protects presentation credentials from caching", async () => {
    await request(app.getHttpServer())
      .get(base + "/balances")
      .expect(200);
    await request(app.getHttpServer())
      .get(base + "/balances?beneficiaryId=" + id)
      .expect(200);
    await request(app.getHttpServer())
      .get(base + "/family")
      .expect(200);
    await request(app.getHttpServer())
      .post(base + "/family")
      .send(input)
      .expect(201);
    await request(app.getHttpServer())
      .post(base + "/family/" + id + "/replace")
      .send(input)
      .expect(201);
    await request(app.getHttpServer())
      .post(base + "/tickets")
      .send({ benefitId: id, units: 1 })
      .expect("Cache-Control", "no-store")
      .expect(201);
    await request(app.getHttpServer())
      .get(base + "/history")
      .expect(200);
    expect(service.family).toHaveBeenCalledWith(id, { limit: 25, offset: 0 }, actor, true);
    expect(service.replaceBeneficiary).toHaveBeenCalledWith(id, id, input, actor, true);
    expect(service.issueTicket).toHaveBeenCalledWith(id, { benefitId: id, units: 1 }, actor);
  });
  it("rejects spoofed identity, accounts, dates and raw quota changes", async () => {
    await request(app.getHttpServer())
      .post(base + "/family")
      .send({ ...input, userId: id })
      .expect(400);
    await request(app.getHttpServer())
      .post(base + "/family")
      .send({ ...input, birthDate: "2000-02-30" })
      .expect(400);
    await request(app.getHttpServer())
      .post(base + "/tickets")
      .send({ benefitId: id, units: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .post(base + "/tickets")
      .send({ benefitId: id, units: 1, remainingUnits: 10 })
      .expect(400);
    await request(app.getHttpServer())
      .get(base + "/balances?patientId=" + id)
      .expect(400);
    await request(app.getHttpServer()).get("/benefits/me/invalid/family").expect(400);
    await request(app.getHttpServer())
      .get(base + "/history?limit=101")
      .expect(400);
  });
});
