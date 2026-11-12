import { ForbiddenException } from "@nestjs/common";
import { AssignPlanBenefitUseCase } from "../../../modules/plans/application/assignPlanBenefit.usecase";
import type { PlanRepository } from "../../../modules/plans/domain/plan.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { userFixture } from "../../helpers/identity.fixture";

describe("AssignPlanBenefitUseCase", () => {
  it("requires plan update authority and forwards the desired assignment state", async () => {
    const assignBenefit = jest.fn().mockResolvedValue(undefined);
    const operation = new AssignPlanBenefitUseCase({ assignBenefit } as unknown as PlanRepository);
    const user = userFixture().toView();
    expect(() => operation.execute("plan", "benefit", true, { ...user, permissions: [] })).toThrow(ForbiddenException);
    const actor = { ...user, permissions: [PermissionCode.PlansUpdate] };
    await operation.execute("plan", "benefit", true, actor);
    expect(assignBenefit).toHaveBeenCalledWith("plan", "benefit", true, actor);
  });
});
