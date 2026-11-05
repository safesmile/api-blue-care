import { ForbiddenException } from "@nestjs/common";
import { DashboardUseCase } from "../../../modules/dashboard/application/dashboard.usecase";
import { userFixture } from "../../helpers/identity.fixture";
describe("DashboardUseCase", () => {
  it("requires an explicit dashboard permission independent of other profile grants", async () => {
    const repository = { metrics: jest.fn(), expiring: jest.fn(), upcoming: jest.fn() },
      service = new DashboardUseCase(repository),
      query = { days: 30, limit: 25, offset: 0 };
    const actor = { ...userFixture().toView(), permissions: ["dashboard:read" as const] };
    expect(() => service.metrics(query, { ...actor, permissions: [] })).toThrow(ForbiddenException);
    expect(() => service.expiring(query, { ...actor, permissions: [] })).toThrow(ForbiddenException);
    expect(() => service.upcoming(query, { ...actor, permissions: [] })).toThrow(ForbiddenException);
    await service.upcoming(query, actor);
    await service.metrics(query, actor);
    await service.expiring(query, actor);
    expect(repository.metrics).toHaveBeenCalledWith(query, actor);
    expect(repository.expiring).toHaveBeenCalledWith(query, actor);
  });
});
