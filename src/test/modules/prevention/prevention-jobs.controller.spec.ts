import request from "supertest";
import { Test } from "@nestjs/testing";
import { PreventionJobsController } from "../../../modules/prevention/presentation/prevention-jobs.controller";
import { PreventionUseCase } from "../../helpers/usecases/PreventionUseCase";
import { GoogleJobGuard } from "../../../infrastructure/jobs/google-job.guard";
describe("PreventionJobsController", () => {
  it("runs only a bounded durable sweep after the internal guard", async () => {
    const service = { drain: jest.fn().mockResolvedValue({ generated: 1 }) };
    const module = await Test.createTestingModule({
      controllers: [PreventionJobsController],
      providers: [...PreventionUseCase.providers(service)]
    })
      .overrideGuard(GoogleJobGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const app = module.createNestApplication();
    await app.init();
    try {
      await request(app.getHttpServer()).post("/internal/jobs/prevention/dispatch").expect(200, { generated: 1 });
    } finally {
      await app.close();
    }
  });
});
