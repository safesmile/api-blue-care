import request from "supertest";
import { PermissionsController } from "../../../modules/authorization/presentation/permissions.controller";
import { RolesUseCase } from "../../helpers/usecases/RolesUseCase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("PermissionsController", () => {
  it("reads the catalog with the session identity", async () => {
    const actor = userFixture().toView(),
      catalog = jest.fn().mockResolvedValue([]);
    const app = await controllerApp(PermissionsController, [...RolesUseCase.providers({ catalog })], actor);
    try {
      await request(app.getHttpServer()).get("/permissions").expect(200, []);
      expect(catalog).toHaveBeenCalledWith(actor);
    } finally {
      await app.close();
    }
  });
});
