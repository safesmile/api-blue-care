import request from "supertest";
import { DashboardController } from "../../../modules/dashboard/presentation/dashboard.controller";
import { DashboardUseCase } from "../../helpers/usecases/DashboardUseCase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("DashboardController", () => {
  it("validates horizons and explicit clinic filters for both read models", async () => {
    const service = { metrics: jest.fn(), expiring: jest.fn(), upcoming: jest.fn() },
      actor = userFixture().toView(),
      app = await controllerApp(DashboardController, [...DashboardUseCase.providers(service)], actor);
    try {
      await request(app.getHttpServer()).get("/dashboard").expect(200);
      await request(app.getHttpServer()).get("/dashboard/prevention/upcoming").expect(200);
      await request(app.getHttpServer()).get("/dashboard/memberships/expiring?days=7").expect(200);
      expect(service.metrics).toHaveBeenCalledWith(expect.objectContaining({ days: 30, limit: 25, offset: 0 }), actor);
      expect(service.expiring).toHaveBeenCalledWith(expect.objectContaining({ days: 7 }), actor);
      for (const query of ["days=0", "days=366", "clinicId=bad", "amount=1"])
        await request(app.getHttpServer())
          .get("/dashboard?" + query)
          .expect(400);
    } finally {
      await app.close();
    }
  });
});
