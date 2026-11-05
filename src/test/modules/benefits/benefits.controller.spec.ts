import request from "supertest";
import { BenefitsController } from "../../../modules/benefits/presentation/benefits.controller";
import { BenefitsUseCase } from "../../../modules/benefits/application/benefits.usecase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("BenefitsController", () => {
  const service = {
    create: jest.fn(),
    read: jest.fn(),
    list: jest.fn(),
    version: jest.fn(),
    versions: jest.fn(),
    publish: jest.fn(),
    familySettings: jest.fn(),
    updateFamilySettings: jest.fn()
  };
  const actor = userFixture().toView(),
    id = "ba50a6d7-3ec5-4fb0-9145-2febbfaf8de8";
  const input = { planId: id, code: "cleaning", kind: "discount", period: "monthly", audience: "all" },
    version = { name: "Benefit", description: "Description", limitUnits: 1, discountBasisPoints: 1500, enabled: true };
  let app;
  beforeAll(async () => {
    app = await controllerApp(BenefitsController, [{ provide: BenefitsUseCase, useValue: service }], actor);
  });
  afterAll(async () => {
    await app.close();
  });
  it("exposes explicit creation, immutable revisions and family configuration routes", async () => {
    await request(app.getHttpServer()).post("/benefits").send(input).expect(201);
    await request(app.getHttpServer())
      .get("/benefits?planId=" + id)
      .expect(200);
    await request(app.getHttpServer())
      .get("/benefits/" + id)
      .expect(200);
    await request(app.getHttpServer())
      .post("/benefits/" + id + "/versions")
      .send(version)
      .expect(201);
    await request(app.getHttpServer())
      .get("/benefits/" + id + "/versions")
      .expect(200);
    await request(app.getHttpServer())
      .post("/benefits/" + id + "/versions/" + id + "/publish")
      .expect(201);
    await request(app.getHttpServer())
      .get("/benefits/plans/" + id + "/family-settings")
      .expect(200);
    await request(app.getHttpServer())
      .put("/benefits/plans/" + id + "/family-settings")
      .send({ maxBeneficiaries: 4 })
      .expect(200);
    expect(service.create).toHaveBeenCalledWith(input, actor);
    expect(service.version).toHaveBeenCalledWith(id, version, actor);
    expect(service.publish).toHaveBeenCalledWith(id, id, actor);
    expect(service.updateFamilySettings).toHaveBeenCalledWith(id, 4, actor);
  });
  it("rejects arbitrary dimensions, invalid limits, extra fields and destructive routes", async () => {
    await request(app.getHttpServer())
      .post("/benefits")
      .send({ ...input, period: "daily" })
      .expect(400);
    await request(app.getHttpServer())
      .post("/benefits/" + id + "/versions")
      .send({ ...version, period: "contract" })
      .expect(400);
    await request(app.getHttpServer())
      .post("/benefits/" + id + "/versions")
      .send({ ...version, discountBasisPoints: 10001 })
      .expect(400);
    await request(app.getHttpServer())
      .put("/benefits/plans/" + id + "/family-settings")
      .send({ maxBeneficiaries: -1 })
      .expect(400);
    await request(app.getHttpServer()).get("/benefits/invalid").expect(400);
    await request(app.getHttpServer()).get("/benefits?limit=101").expect(400);
    await request(app.getHttpServer())
      .delete("/benefits/" + id)
      .expect(404);
  });
});
