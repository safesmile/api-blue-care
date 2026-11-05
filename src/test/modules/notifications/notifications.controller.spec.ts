import request from "supertest";
import { NotificationsController } from "../../../modules/notifications/presentation/notifications.controller";
import { NotificationsUseCase } from "../../../modules/notifications/application/notifications.usecase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("NotificationsController", () => {
  const notifications = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }), markRead: jest.fn() };
  const owner = userFixture().toView();
  let app: Awaited<ReturnType<typeof controllerApp>>;
  beforeAll(async () => {
    app = await controllerApp(
      NotificationsController,
      [{ provide: NotificationsUseCase, useValue: notifications }],
      owner
    );
  });
  afterAll(async () => {
    await app.close();
  });
  it("uses the session owner and bounded pagination", async () => {
    await request(app.getHttpServer()).get("/notifications").expect(200, { items: [], total: 0 });
    expect(notifications.list).toHaveBeenCalledWith(owner.id, 25, 0);
    await request(app.getHttpServer()).get("/notifications?limit=101").expect(400);
    await request(app.getHttpServer()).get("/notifications?userId=other").expect(400);
  });
  it("marks own records and validates UUIDs", async () => {
    await request(app.getHttpServer())
      .patch("/notifications/" + owner.id + "/read")
      .expect(204);
    expect(notifications.markRead).toHaveBeenCalledWith(owner.id, owner.id);
    await request(app.getHttpServer()).patch("/notifications/invalid/read").expect(400);
  });
});
