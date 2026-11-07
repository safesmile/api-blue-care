import request from "supertest";
import { AuditController } from "../../../modules/audit/presentation/audit.controller";
import { AuditUseCase } from "../../helpers/usecases/AuditUseCase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("AuditController", () => {
  const audit = {
      list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      read: jest.fn().mockResolvedValue({ id: "record" })
    },
    actor = userFixture().toView();
  let app;
  beforeAll(async () => {
    app = await controllerApp(AuditController, [...AuditUseCase.providers(audit)], actor);
  });
  afterAll(async () => {
    await app.close();
  });
  it("forwards the session actor and validated filters", async () => {
    await request(app.getHttpServer()).get("/audit?resourceType=user&action=user.updated").expect(200);
    expect(audit.list).toHaveBeenCalledWith(
      { limit: 25, offset: 0, resourceType: "user", action: "user.updated" },
      actor
    );
    await request(app.getHttpServer())
      .get("/audit/" + actor.id)
      .expect(200);
    expect(audit.read).toHaveBeenCalledWith(actor.id, actor);
  });
  it.each([
    "limit=101",
    "actorId=invalid",
    "action=anything%27%20OR%201=1",
    "resourceType=bad%20type",
    "from=not-a-date",
    "from=2026-11-03",
    "extra=field"
  ])("rejects unbounded or unknown query %s", async query => {
    await request(app.getHttpServer())
      .get("/audit?" + query)
      .expect(400);
  });
  it("validates record IDs and exposes no mutation endpoints", async () => {
    await request(app.getHttpServer()).get("/audit/invalid").expect(400);
    await request(app.getHttpServer()).post("/audit").send({}).expect(404);
    await request(app.getHttpServer())
      .delete("/audit/" + actor.id)
      .expect(404);
  });
});
