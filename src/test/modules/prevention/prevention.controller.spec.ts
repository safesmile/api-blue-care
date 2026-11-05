import request from "supertest";
import { PreventionController } from "../../../modules/prevention/presentation/prevention.controller";
import { PreventionUseCase } from "../../../modules/prevention/application/prevention.usecase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("PreventionController", () => {
  const service = {
    types: jest.fn(),
    saveType: jest.fn(),
    create: jest.fn(),
    read: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    complete: jest.fn(),
    cancel: jest.fn()
  };
  const actor = userFixture().toView(),
    id = "ba50a6d7-3ec5-4fb0-9145-2febbfaf8de8",
    schedule = { dueAt: "2030-01-01T16:00:00Z", status: "planned", intervalMonths: 6 },
    input = { ...schedule, patientId: id, clinicId: id, typeId: id, idempotencyKey: id };
  let app;
  beforeAll(async () => {
    app = await controllerApp(PreventionController, [{ provide: PreventionUseCase, useValue: service }], actor);
  });
  afterAll(async () => {
    await app.close();
  });
  it("exposes explicit configuration and lifecycle operations with validated versions", async () => {
    await request(app.getHttpServer()).get("/prevention/types").expect(200);
    const type = { code: "cleaning", name: "Cleaning", enabled: true };
    await request(app.getHttpServer()).post("/prevention/types").send(type).expect(201);
    await request(app.getHttpServer())
      .put("/prevention/types/" + id)
      .send(type)
      .expect(200);
    await request(app.getHttpServer())
      .get("/prevention/events?status=scheduled&clinicId=" + id)
      .expect(200);
    await request(app.getHttpServer())
      .get("/prevention/events/" + id)
      .expect(200);
    await request(app.getHttpServer()).post("/prevention/events").send(input).expect(201);
    await request(app.getHttpServer())
      .patch("/prevention/events/" + id)
      .send({ ...schedule, expectedVersion: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .post("/prevention/events/" + id + "/complete")
      .send({ expectedVersion: 1, occurredAt: schedule.dueAt })
      .expect(201);
    await request(app.getHttpServer())
      .post("/prevention/events/" + id + "/cancel")
      .send({ expectedVersion: 1 })
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ reminderHours: [168, 24] }), actor);
    expect(service.complete).toHaveBeenCalledWith(id, 1, schedule.dueAt, actor);
  });
  it("rejects arbitrary actors, ambiguous dates, invalid intervals and extra mutation fields", async () => {
    for (const extra of [
      { dueAt: "2030-01-01" },
      { status: "completed" },
      { intervalMonths: 0 },
      { intervalMonths: undefined },
      { reminderHours: [24, 24] },
      { reminderHours: [0] },
      { performedBy: id }
    ])
      await request(app.getHttpServer())
        .post("/prevention/events")
        .send({ ...input, ...extra })
        .expect(400);
    await request(app.getHttpServer())
      .post("/prevention/events")
      .send({ ...input, intervalMonths: null, reminderHours: [] })
      .expect(201);
    await request(app.getHttpServer())
      .patch("/prevention/events/" + id)
      .send(schedule)
      .expect(400);
    await request(app.getHttpServer())
      .post("/prevention/events/" + id + "/complete")
      .send({ expectedVersion: 1, occurredAt: "bad" })
      .expect(400);
    await request(app.getHttpServer()).get("/prevention/events?limit=101").expect(400);
    await request(app.getHttpServer()).get("/prevention/events/bad").expect(400);
    await request(app.getHttpServer())
      .delete("/prevention/events/" + id)
      .expect(404);
  });
});
