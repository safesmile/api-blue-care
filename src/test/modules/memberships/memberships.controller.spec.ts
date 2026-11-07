import request from "supertest";
import { MembershipsController } from "../../../modules/memberships/presentation/memberships.controller";
import { MembershipsUseCase } from "../../helpers/usecases/MembershipsUseCase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("MembershipsController", () => {
  const service = {
    create: jest.fn(),
    createOwn: jest.fn(),
    read: jest.fn(),
    list: jest.fn(),
    cancel: jest.fn(),
    suspend: jest.fn(),
    periods: jest.fn(),
    checkout: jest.fn()
  };
  const actor = userFixture().toView(),
    id = "ba50a6d7-3ec5-4fb0-9145-2febbfaf8de8",
    input = { planVersionId: id, cadence: "monthly" };
  let app;
  beforeAll(async () => {
    app = await controllerApp(MembershipsController, [...MembershipsUseCase.providers(service)], actor);
  });
  afterAll(async () => {
    await app.close();
  });
  it("routes own identity independently from administrative scope", async () => {
    await request(app.getHttpServer()).post("/memberships/me").send(input).expect(201);
    await request(app.getHttpServer())
      .post("/memberships")
      .send({ ...input, patientId: id })
      .expect(201);
    await request(app.getHttpServer()).get("/memberships/me").expect(200);
    await request(app.getHttpServer()).get("/memberships").expect(200);
    await request(app.getHttpServer())
      .get("/memberships/me/" + id)
      .expect(200);
    await request(app.getHttpServer())
      .get("/memberships/" + id)
      .expect(200);
    await request(app.getHttpServer())
      .get("/memberships/me/" + id + "/periods")
      .expect(200);
    await request(app.getHttpServer())
      .get("/memberships/" + id + "/periods")
      .expect(200);
    await request(app.getHttpServer())
      .post("/memberships/me/" + id + "/checkout")
      .expect(201);
    await request(app.getHttpServer())
      .post("/memberships/me/" + id + "/cancel")
      .expect(201);
    await request(app.getHttpServer())
      .post("/memberships/" + id + "/cancel")
      .expect(201);
    await request(app.getHttpServer())
      .post("/memberships/" + id + "/suspend")
      .expect(201);
    expect(service.read).toHaveBeenCalledWith(id, actor, true);
    expect(service.cancel).toHaveBeenCalledWith(id, actor, true);
    expect(service.checkout).toHaveBeenCalledWith(id, actor);
  });
  it("does not accept entitlement flags, patient spoofing or arbitrary paid amounts", async () => {
    for (const extra of [{ patientId: id }, { amountCents: 1 }, { status: "active" }, { paidThrough: "2030-01-01" }])
      await request(app.getHttpServer())
        .post("/memberships/me")
        .send({ ...input, ...extra })
        .expect(400);
    await request(app.getHttpServer())
      .post("/memberships/me")
      .send({ ...input, cadence: "week" })
      .expect(400);
    await request(app.getHttpServer()).get("/memberships/me/not-uuid").expect(400);
    await request(app.getHttpServer())
      .get("/memberships/me?patientId=" + id)
      .expect(400);
    await request(app.getHttpServer())
      .post("/memberships/me/" + id + "/checkout")
      .send({ amountCents: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .patch("/memberships/" + id)
      .send({ status: "active" })
      .expect(404);
  });
});
