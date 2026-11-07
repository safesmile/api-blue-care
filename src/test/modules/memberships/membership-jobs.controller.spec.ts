import { Test } from "@nestjs/testing";
import request from "supertest";
import { MembershipJobsController } from "../../../modules/memberships/presentation/membership-jobs.controller";
import { MembershipsUseCase } from "../../helpers/usecases/MembershipsUseCase";
import { GoogleJobGuard } from "../../../infrastructure/jobs/google-job.guard";
describe("MembershipJobsController", () => {
  let app;
  const service = { drain: jest.fn().mockResolvedValue({ payments: 1, commands: 1 }) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MembershipJobsController],
      providers: [...MembershipsUseCase.providers(service)]
    })
      .overrideGuard(GoogleJobGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it("runs a bounded durable sweep after the internal guard", async () => {
    await request(app.getHttpServer())
      .post("/internal/jobs/memberships/dispatch")
      .expect(200, { payments: 1, commands: 1 });
    expect(service.drain).toHaveBeenCalledTimes(1);
  });
});
