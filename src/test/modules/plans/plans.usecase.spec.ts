import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PlansUseCase } from "../../helpers/usecases/PlansUseCase";
import { REGISTERED_PERMISSIONS } from "../../../modules/authorization/infrastructure/permission-registry";
import { userFixture } from "../../helpers/identity.fixture";
import { PermissionCode } from "../../../shared/domain/permission-code";
describe("PlansUseCase", () => {
  const repository = {
    create: jest.fn(),
    read: jest.fn(),
    list: jest.fn(),
    version: jest.fn(),
    versions: jest.fn(),
    publish: jest.fn(),
    update: jest.fn(),
    assignBenefit: jest.fn()
  };
  const service = new PlansUseCase(repository),
    actor = { ...userFixture().toView(), permissions: REGISTERED_PERMISSIONS.map(p => p.shortcode) },
    page = { limit: 25, offset: 0 };
  const input = {
    name: "Blue Care +",
    description: "Membership",
    benefitDescriptions: ["Clinic benefits"],
    monthlyPriceCents: 10000,
    annualPriceCents: 87000,
    taxDisclosure: "Final price"
  };
  it("requires explicit permission before delegating operations", () => {
    expect(() => service.list(page, { ...actor, permissions: [] })).toThrow(ForbiddenException);
    expect(() =>
      service.version(
        "plan",
        { ...input, maxBeneficiaries: 3 },
        {
          ...actor,
          permissions: [PermissionCode.PlansVersion]
        }
      )
    ).toThrow(ForbiddenException);
  });
  it("returns drafts, publication and bounded history without editing prices in place", async () => {
    await expect(service.read("missing", actor)).rejects.toBeInstanceOf(NotFoundException);
    repository.read.mockResolvedValue(input);
    expect(await service.read("plan", actor)).toBe(input);
    await service.create("blue-care-plus", actor);
    await service.list(page, actor);
    await service.catalog(page, actor);
    await service.version("plan", input, actor);
    await service.version("plan", { ...input, maxBeneficiaries: 0 }, actor);
    await service.versions("plan", page, actor);
    await service.publish("plan", "version", actor);
    await service.update("plan", false, actor);
    expect(repository.version).toHaveBeenCalledWith("plan", input, actor);
    expect(repository.list).toHaveBeenCalledWith(page, true);
  });
  it.each([1.5, 0, 499, 100000001])("rejects invalid final cent amounts %s", monthlyPriceCents => {
    expect(() => service.version("plan", { ...input, monthlyPriceCents }, actor)).toThrow(BadRequestException);
  });
  it.each([1.5, 499, 1000000001])("rejects invalid annual cent amounts %s", annualPriceCents => {
    expect(() => service.version("plan", { ...input, annualPriceCents }, actor)).toThrow(BadRequestException);
  });
});
