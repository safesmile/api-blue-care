import { Test } from "@nestjs/testing";
import request from "supertest";
import { RecurrenteWebhookController } from "../../../modules/memberships/presentation/recurrente-webhook.controller";
import { MembershipsUseCase } from "../../helpers/usecases/MembershipsUseCase";
describe("RecurrenteWebhookController", () => {
  let app;
  const service = { receive: jest.fn().mockResolvedValue(undefined) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [RecurrenteWebhookController],
      providers: [...MembershipsUseCase.providers(service)]
    }).compile();
    app = module.createNestApplication({ rawBody: true });
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it("forwards original JSON bytes instead of reconstructing the provider signature input", async () => {
    const body = '{ "id" : "in_test", "event_type" : "intent.succeeded" }';
    await request(app.getHttpServer())
      .post("/webhooks/recurrente")
      .set("Content-Type", "application/json")
      .set("svix-id", "message")
      .send(body)
      .expect(204);
    expect(service.receive).toHaveBeenCalledWith(Buffer.from(body), expect.objectContaining({ "svix-id": "message" }));
  });
});
