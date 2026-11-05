import { PushUseCase } from "../../../modules/notifications/application/push.usecase";
import request from "supertest";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { NotificationJobsController } from "../../../modules/notifications/presentation/notification-jobs.controller";
import { NotificationsUseCase } from "../../../modules/notifications/application/notifications.usecase";
import { GoogleJobGuard } from "../../../infrastructure/jobs/google-job.guard";
describe("NotificationJobsController", () => {
  const notifications = { deliver: jest.fn(), drain: jest.fn().mockResolvedValue({ sent: 1 }) };
  let app;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NotificationJobsController],
      providers: [
        { provide: NotificationsUseCase, useValue: notifications },
        { provide: PushUseCase, useValue: { drain: jest.fn().mockResolvedValue({ sent: 2 }) } }
      ]
    })
      .overrideGuard(GoogleJobGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it("acknowledges delivered jobs, retries deferred jobs and validates payloads", async () => {
    notifications.deliver.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const id = "b9c78bd8-7534-4ce9-9621-285a71498664";
    await request(app.getHttpServer()).post("/internal/jobs/notifications/deliver").send({ id }).expect(204);
    await request(app.getHttpServer()).post("/internal/jobs/notifications/deliver").send({ id }).expect(503);
    await request(app.getHttpServer()).post("/internal/jobs/notifications/deliver").send({ id: "bad" }).expect(400);
    await request(app.getHttpServer())
      .post("/internal/jobs/notifications/deliver")
      .send({ id, email: "other" })
      .expect(400);
  });
  it("runs a recovery batch", async () => {
    await request(app.getHttpServer())
      .post("/internal/jobs/notifications/dispatch")
      .expect(200, { sent: 1, pushSent: 2 });
  });
});
