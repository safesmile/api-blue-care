import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { BenefitOperationsUseCase } from "../../helpers/usecases/BenefitOperationsUseCase";
import { REGISTERED_PERMISSIONS } from "../../../modules/authorization/infrastructure/permission-registry";
import { userFixture } from "../../helpers/identity.fixture";
describe("BenefitOperationsUseCase", () => {
  const repository = {
    family: jest.fn(),
    addBeneficiary: jest.fn(),
    replaceBeneficiary: jest.fn(),
    balances: jest.fn(),
    issueTicket: jest.fn(),
    consume: jest.fn(),
    consumeTicket: jest.fn(),
    reverse: jest.fn(),
    history: jest.fn(),
    clinicHistory: jest.fn()
  };
  const service = new BenefitOperationsUseCase(repository),
    actor = { ...userFixture().toView(), permissions: REGISTERED_PERMISSIONS.map(p => p.shortcode) },
    page = { limit: 25, offset: 0 };
  const family = { firstName: " Relative ", lastName: " Example " },
    consumption = {
      membershipId: "membership",
      benefitId: "benefit",
      clinicId: "clinic",
      units: 1,
      serviceReference: "service",
      idempotencyKey: "key"
    };
  it("does not infer administrative consumption or correction authority from an own-profile grant", () => {
    expect(() => service.consume(consumption, { ...actor, permissions: ["benefits:self"] })).toThrow(
      ForbiddenException
    );
    expect(() => service.reverse("id", "reason", "key", { ...actor, permissions: ["benefits:consume"] })).toThrow(
      ForbiddenException
    );
  });
  it("delegates scoped and owner operations and trims family names and correction reasons", async () => {
    await service.family("membership", page, actor);
    await service.family("membership", page, actor, true);
    await service.addBeneficiary("membership", family, actor);
    await service.addBeneficiary("membership", { ...family, birthDate: "2000-01-01" }, actor, true);
    await service.replaceBeneficiary("membership", "relative", family, actor);
    await service.replaceBeneficiary("membership", "relative", family, actor, true);
    await service.balances("membership", undefined, page, actor);
    await service.balances("membership", "relative", page, actor, true);
    await service.issueTicket("membership", { benefitId: "benefit", units: 1 }, actor);
    await service.consume(consumption, actor);
    await service.consumeTicket(
      { token: "ticket", clinicId: "clinic", serviceReference: "service", idempotencyKey: "key" },
      actor
    );
    await service.reverse("consumption", " Correction ", "key", actor);
    await service.history("membership", page, actor);
    await service.history("membership", page, actor, true);
    await service.clinicHistory("clinic", page, actor);
    expect(repository.addBeneficiary).toHaveBeenCalledWith(
      "membership",
      { firstName: "Relative", lastName: "Example", birthDate: null },
      actor,
      false
    );
    expect(repository.reverse).toHaveBeenCalledWith("consumption", "Correction", "key", actor);
  });
  it("rejects invalid units, names, dates and absent correction reasons", () => {
    for (const units of [0, 1.5, 1001])
      expect(() => service.consume({ ...consumption, units }, actor)).toThrow(BadRequestException);
    expect(() => service.addBeneficiary("membership", { ...family, firstName: " " }, actor)).toThrow(
      BadRequestException
    );
    for (const birthDate of ["bad", "0000-01-01", "2000-99-99", "2000-02-30", "3000-01-01"])
      expect(() => service.addBeneficiary("membership", { ...family, birthDate }, actor)).toThrow(BadRequestException);
    for (const reason of [" ", "x".repeat(501)])
      expect(() => service.reverse("id", reason, "key", actor)).toThrow(BadRequestException);
  });
});
