import request from "supertest";
import { PushController } from "../../../modules/notifications/presentation/push.controller";
import { PushUseCase } from "../../../modules/notifications/application/push.usecase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("PushController", () => {
  it("accepts write-only device tokens for the current identity and bounded listing", async () => {
    const service = { register: jest.fn(), list: jest.fn(), remove: jest.fn() },
      actor = userFixture().toView(),
      app = await controllerApp(PushController, [{ provide: PushUseCase, useValue: service }], actor),
      id = "ba50a6d7-3ec5-4fb0-9145-2febbfaf8de8",
      input = { token: "opaque-device-token-example", platform: "web" };
    try {
      await request(app.getHttpServer()).post("/notifications/devices").send(input).expect(201);
      await request(app.getHttpServer()).get("/notifications/devices").expect(200);
      await request(app.getHttpServer())
        .delete("/notifications/devices/" + id)
        .expect(204);
      expect(service.register).toHaveBeenCalledWith(input, actor);
      expect(service.remove).toHaveBeenCalledWith(id, actor);
      for (const extra of [{ token: "bad" }, { platform: "any" }, { userId: id }])
        await request(app.getHttpServer())
          .post("/notifications/devices")
          .send({ ...input, ...extra })
          .expect(400);
    } finally {
      await app.close();
    }
  });
});
