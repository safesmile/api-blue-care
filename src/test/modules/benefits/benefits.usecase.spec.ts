import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BenefitsUseCase } from "../../helpers/usecases/BenefitsUseCase";
import { REGISTERED_PERMISSIONS } from "../../../modules/authorization/infrastructure/permission-registry";
import { userFixture } from "../../helpers/identity.fixture";
describe("BenefitsUseCase", () => {
  const repository = {
    create: jest.fn(),
    read: jest.fn(),
    list: jest.fn(),
    version: jest.fn(),
    versions: jest.fn(),
    publish: jest.fn(),
    familySettings: jest.fn(),
    updateFamilySettings: jest.fn()
  };
  const service = new BenefitsUseCase(repository),
    actor = { ...userFixture().toView(), permissions: REGISTERED_PERMISSIONS.map(p => p.shortcode) },
    page = { limit: 25, offset: 0 };
  const definition = {
    planId: "plan",
    code: "cleaning",
    kind: "discount" as const,
    period: "monthly" as const,
    audience: "all" as const
  };
  const version = {
    name: "Benefit",
    description: "Description",
    limitUnits: 1,
    discountBasisPoints: 1500,
    enabled: true
  };
  it("requires operation authority and handles missing definitions", async () => {
    expect(() => service.list(page, { ...actor, permissions: [] })).toThrow(ForbiddenException);
    await expect(service.read("missing", actor)).rejects.toBeInstanceOf(NotFoundException);
  });
  it("delegates explicit definition, revision, publication and capacity operations", async () => {
    repository.read.mockResolvedValue(definition);
    expect(await service.read("benefit", actor)).toBe(definition);
    await service.create(definition, actor);
    await service.list(page, actor);
    await service.version("benefit", version, actor);
    await service.version("benefit", { ...version, discountBasisPoints: null }, actor);
    await service.version("benefit", { ...version, discountBasisPoints: undefined }, actor);
    await service.versions("benefit", page, actor);
    await service.publish("benefit", "version", actor);
    await service.familySettings("plan", actor);
    await service.updateFamilySettings("plan", 4, actor);
    expect(repository.publish).toHaveBeenCalledWith("benefit", "version", actor);
    expect(repository.updateFamilySettings).toHaveBeenCalledWith("plan", 4, actor);
  });
  it("rejects invalid limits and discount ratios independently of the transport", () => {
    for (const limitUnits of [1.5, 0, 100001])
      expect(() => service.version("benefit", { ...version, limitUnits }, actor)).toThrow(BadRequestException);
    for (const discountBasisPoints of [1.5, 0, 10001])
      expect(() => service.version("benefit", { ...version, discountBasisPoints }, actor)).toThrow(BadRequestException);
    for (const max of [-1, 1.5, 101])
      expect(() => service.updateFamilySettings("plan", max, actor)).toThrow(BadRequestException);
  });
});
