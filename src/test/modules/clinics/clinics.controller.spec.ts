import request from "supertest";
import { ClinicsController } from "../../../modules/clinics/presentation/clinics.controller";
import { ClinicsUseCase } from "../../../modules/clinics/application/clinics.usecase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("ClinicsController", () => {
  const clinics = {
    create: jest.fn(),
    read: jest.fn(),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    update: jest.fn(),
    staff: jest.fn(),
    assign: jest.fn(),
    unassign: jest.fn()
  };
  const actor = userFixture().toView(),
    id = "ba50a6d7-3ec5-4fb0-9145-2febbfaf8de8",
    userId = "af9a5c61-1c31-45bc-88bb-b6a02305a54a";
  let app;
  beforeAll(async () => {
    app = await controllerApp(ClinicsController, [{ provide: ClinicsUseCase, useValue: clinics }], actor);
  });
  afterAll(async () => {
    await app.close();
  });
  it("forwards validated input and the session actor on every route", async () => {
    await request(app.getHttpServer()).post("/clinics").send({ code: "north", name: "North" }).expect(201);
    await request(app.getHttpServer()).get("/clinics?enabled=false&search=North").expect(200);
    await request(app.getHttpServer()).get("/clinics?enabled=true").expect(200);
    await request(app.getHttpServer()).get("/clinics").expect(200);
    await request(app.getHttpServer())
      .get("/clinics/" + id)
      .expect(200);
    await request(app.getHttpServer())
      .patch("/clinics/" + id)
      .send({ enabled: false, address: null })
      .expect(200);
    await request(app.getHttpServer())
      .get("/clinics/" + id + "/staff")
      .expect(200);
    await request(app.getHttpServer())
      .put("/clinics/" + id + "/staff/" + userId)
      .send({ reason: "Assignment" })
      .expect(204);
    await request(app.getHttpServer())
      .delete("/clinics/" + id + "/staff/" + userId)
      .expect(204);
    expect(clinics.assign).toHaveBeenCalledWith(id, userId, actor);
    expect(clinics.unassign).toHaveBeenCalledWith(id, userId, actor);
    expect(clinics.update).toHaveBeenCalledWith(id, { enabled: false, address: null }, actor);
  });
  it("rejects malformed and hidden fields and provides no destructive catalog route", async () => {
    await request(app.getHttpServer()).post("/clinics").send({ code: "North", name: "North" }).expect(400);
    await request(app.getHttpServer())
      .post("/clinics")
      .send({ code: "north", name: "North", enabled: true })
      .expect(400);
    await request(app.getHttpServer()).get("/clinics/invalid").expect(400);
    await request(app.getHttpServer()).get("/clinics?enabled=unknown").expect(400);
    await request(app.getHttpServer()).get("/clinics?limit=101").expect(400);
    await request(app.getHttpServer()).get("/clinics?sql=anything").expect(400);
    await request(app.getHttpServer())
      .patch("/clinics/" + id)
      .send({ name: null })
      .expect(400);
    await request(app.getHttpServer())
      .delete("/clinics/" + id)
      .expect(404);
  });
});
