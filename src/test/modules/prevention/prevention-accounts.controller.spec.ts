import request from "supertest";
import { PreventionAccountsController } from "../../../modules/prevention/presentation/prevention-accounts.controller";
import { PreventionUseCase } from "../../../modules/prevention/application/prevention.usecase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("PreventionAccountsController", () => {
  it("forces ownership for timeline and details and exposes no self write endpoint", async () => {
    const service = { list: jest.fn(), read: jest.fn() },
      actor = userFixture().toView(),
      id = "ba50a6d7-3ec5-4fb0-9145-2febbfaf8de8";
    const app = await controllerApp(
      PreventionAccountsController,
      [{ provide: PreventionUseCase, useValue: service }],
      actor
    );
    try {
      await request(app.getHttpServer()).get("/prevention/me/events").expect(200);
      await request(app.getHttpServer())
        .get("/prevention/me/events/" + id)
        .expect(200);
      expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 25, offset: 0 }), actor, true);
      expect(service.read).toHaveBeenCalledWith(id, actor, true);
      await request(app.getHttpServer()).post("/prevention/me/events").send({}).expect(404);
    } finally {
      await app.close();
    }
  });
});
