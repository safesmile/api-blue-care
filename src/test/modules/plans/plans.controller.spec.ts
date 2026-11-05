import request from "supertest";
import { PlansController } from "../../../modules/plans/presentation/plans.controller";
import { PlansUseCase } from "../../../modules/plans/application/plans.usecase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("PlansController", () => {
  const service = {
    create: jest.fn(),
    read: jest.fn(),
    list: jest.fn(),
    catalog: jest.fn(),
    version: jest.fn(),
    versions: jest.fn(),
    publish: jest.fn(),
    update: jest.fn()
  };
  const actor = userFixture().toView(),
    id = "ba50a6d7-3ec5-4fb0-9145-2febbfaf8de8";
  const input = {
    name: "Blue Care +",
    description: "Membership",
    benefitDescriptions: ["Benefits"],
    monthlyPriceCents: 10000,
    taxDisclosure: "Final total"
  };
  let app;
  beforeAll(async () => {
    app = await controllerApp(PlansController, [{ provide: PlansUseCase, useValue: service }], actor);
  });
  afterAll(async () => {
    await app.close();
  });
  it("exposes explicit catalog, revision and publication routes", async () => {
    await request(app.getHttpServer()).post("/plans").send({ code: "blue-care-plus" }).expect(201);
    await request(app.getHttpServer()).get("/plans").expect(200);
    await request(app.getHttpServer()).get("/plans/catalog").expect(200);
    await request(app.getHttpServer())
      .get("/plans/" + id)
      .expect(200);
    await request(app.getHttpServer())
      .post("/plans/" + id + "/versions")
      .send(input)
      .expect(201);
    await request(app.getHttpServer())
      .get("/plans/" + id + "/versions")
      .expect(200);
    await request(app.getHttpServer())
      .post("/plans/" + id + "/versions/" + id + "/publish")
      .expect(201);
    await request(app.getHttpServer())
      .patch("/plans/" + id)
      .send({ enabled: false })
      .expect(200);
    expect(service.version).toHaveBeenCalledWith(id, input, actor);
    expect(service.publish).toHaveBeenCalledWith(id, id, actor);
  });
  it("rejects price overrides, invalid amounts, extra fields and destructive routes", async () => {
    for (const extra of [
      { annualPriceCents: 1 },
      { currency: "USD" },
      { monthlyPriceCents: 1.5 },
      { benefitDescriptions: [{ amount: 1 }] }
    ])
      await request(app.getHttpServer())
        .post("/plans/" + id + "/versions")
        .send({ ...input, ...extra })
        .expect(400);
    await request(app.getHttpServer()).get("/plans/not-uuid").expect(400);
    await request(app.getHttpServer()).get("/plans?limit=101").expect(400);
    await request(app.getHttpServer())
      .patch("/plans/" + id)
      .send({ enabled: null })
      .expect(400);
    await request(app.getHttpServer())
      .delete("/plans/" + id)
      .expect(404);
  });
});
