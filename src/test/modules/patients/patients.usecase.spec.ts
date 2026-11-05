import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PatientsUseCase } from "../../../modules/patients/application/patients.usecase";
import { REGISTERED_PERMISSIONS } from "../../../modules/authorization/infrastructure/permission-registry";
import { userFixture } from "../../helpers/identity.fixture";
describe("PatientsUseCase", () => {
  const repository = {
    create: jest.fn(),
    read: jest.fn(),
    own: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    updateOwn: jest.fn(),
    link: jest.fn(),
    associate: jest.fn(),
    dissociate: jest.fn(),
    clinics: jest.fn()
  };
  const service = new PatientsUseCase(repository),
    actor = { ...userFixture().toView(), permissions: REGISTERED_PERMISSIONS.map(p => p.shortcode) };
  const input = { firstName: "Patient", lastName: "Example", clinicId: "clinic" },
    page = { limit: 25, offset: 0 };
  it("requires permission before accessing a patient", async () => {
    expect(() => service.list(page, { ...actor, permissions: [] })).toThrow(ForbiddenException);
    await expect(service.own({ ...actor, permissions: [] })).rejects.toBeInstanceOf(ForbiddenException);
    expect(() => service.associate("patient", "clinic", { ...actor, permissions: ["patients:update"] })).toThrow(
      ForbiddenException
    );
  });
  it("rejects missing patients and missing owner associations", async () => {
    await expect(service.read("missing", actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.own(actor)).rejects.toBeInstanceOf(NotFoundException);
  });
  it("delegates administrative operations and restricts owner updates to their own non-verifying fields", async () => {
    repository.read.mockResolvedValue(input);
    repository.own.mockResolvedValue({ ...input, id: "patient" });
    expect(await service.read("patient", actor)).toBe(input);
    await service.create(input, actor);
    await service.list(page, actor);
    await service.update("patient", { phone: null }, actor);
    await service.update("patient", { firstName: "A" }, actor);
    await service.update("patient", { lastName: "B" }, actor);
    await service.link("patient", "user", actor);
    await service.associate("patient", "clinic", actor);
    await service.dissociate("patient", "clinic", actor);
    await service.clinics("patient", actor);
    await service.updateOwn({ phone: "12345678", birthDate: "2000-01-01", address: null }, actor);
    expect(repository.updateOwn).toHaveBeenCalledWith(
      actor.id,
      { phone: "12345678", birthDate: "2000-01-01", address: null },
      actor
    );
    expect(repository.link).toHaveBeenCalledWith("patient", "user", actor);
  });
  it("rejects invalid names and impossible or future birth dates", () => {
    expect(() => service.create({ ...input, firstName: " " }, actor)).toThrow(BadRequestException);
    for (const birthDate of ["bad", "0000-01-01", "2000-99-99", "2000-02-30", "3000-01-01"])
      expect(() => service.update("patient", { birthDate }, actor)).toThrow(BadRequestException);
    service.update("patient", { birthDate: "2000-01-01" }, actor);
  });
});
