import request from "supertest";
import { PatientsController } from "../../../modules/patients/presentation/patients.controller";
import { PatientsUseCase } from "../../helpers/usecases/PatientsUseCase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("PatientsController", () => {
  const patients = {
    create: jest.fn(),
    read: jest.fn(),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    update: jest.fn(),
    own: jest.fn(),
    updateOwn: jest.fn(),
    link: jest.fn(),
    associate: jest.fn(),
    dissociate: jest.fn(),
    clinics: jest.fn()
  };
  const actor = userFixture().toView(),
    id = "ba50a6d7-3ec5-4fb0-9145-2febbfaf8de8",
    userId = "af9a5c61-1c31-45bc-88bb-b6a02305a54a";
  const input = { firstName: "Patient", lastName: "Example", clinicId: id };
  let app;
  beforeAll(async () => {
    app = await controllerApp(PatientsController, [...PatientsUseCase.providers(patients)], actor);
  });
  afterAll(async () => {
    await app.close();
  });
  it("forwards explicit administrative and owner routes", async () => {
    await request(app.getHttpServer()).post("/patients").send(input).expect(201);
    await request(app.getHttpServer()).get("/patients?enabled=false&search=Patient").expect(200);
    await request(app.getHttpServer())
      .get("/patients?enabled=true&clinicId=" + id)
      .expect(200);
    await request(app.getHttpServer()).get("/patients").expect(200);
    await request(app.getHttpServer())
      .get("/patients/" + id)
      .expect(200);
    await request(app.getHttpServer())
      .patch("/patients/" + id)
      .send({ enabled: false, phone: null })
      .expect(200);
    await request(app.getHttpServer()).get("/patients/me").expect(200);
    await request(app.getHttpServer()).patch("/patients/me").send({ address: "New address" }).expect(200);
    await request(app.getHttpServer())
      .post("/patients/" + id + "/account")
      .send({ userId })
      .expect(201);
    await request(app.getHttpServer())
      .get("/patients/" + id + "/clinics")
      .expect(200);
    await request(app.getHttpServer())
      .put("/patients/" + id + "/clinics/" + userId)
      .expect(204);
    await request(app.getHttpServer())
      .delete("/patients/" + id + "/clinics/" + userId)
      .expect(204);
    expect(patients.link).toHaveBeenCalledWith(id, userId, actor);
    expect(patients.updateOwn).toHaveBeenCalledWith({ address: "New address" }, actor);
    expect(patients.associate).toHaveBeenCalledWith(id, userId, actor);
    expect(patients.own).toHaveBeenCalledWith(actor);
  });
  it("rejects arbitrary links, privilege fields, invalid dates and identifiers", async () => {
    for (const extra of [{ userId }, { enabled: true }, { membershipId: id }])
      await request(app.getHttpServer())
        .post("/patients")
        .send({ ...input, ...extra })
        .expect(400);
    await request(app.getHttpServer())
      .post("/patients")
      .send({ ...input, dpi: "123" })
      .expect(400);
    await request(app.getHttpServer())
      .patch("/patients/" + id)
      .send({ birthDate: "2000-02-30" })
      .expect(400);
    await request(app.getHttpServer()).patch("/patients/me").send({ email: "other@blue.test" }).expect(400);
    await request(app.getHttpServer()).patch("/patients/me").send({ enabled: false }).expect(400);
    await request(app.getHttpServer()).get("/patients/invalid").expect(400);
    await request(app.getHttpServer()).get("/patients?limit=101").expect(400);
    await request(app.getHttpServer()).get("/patients?enabled=unknown").expect(400);
    await request(app.getHttpServer())
      .delete("/patients/" + id)
      .expect(404);
  });
});
