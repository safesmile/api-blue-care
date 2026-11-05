import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ClinicsUseCase } from "../../../modules/clinics/application/clinics.usecase";
import { REGISTERED_PERMISSIONS } from "../../../modules/authorization/infrastructure/permission-registry";
import { userFixture } from "../../helpers/identity.fixture";
describe("ClinicsUseCase", () => {
  const repository = {
    create: jest.fn(),
    read: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    staff: jest.fn(),
    assign: jest.fn(),
    unassign: jest.fn()
  };
  const service = new ClinicsUseCase(repository),
    actor = { ...userFixture().toView(), permissions: REGISTERED_PERMISSIONS.map(p => p.shortcode) };
  const input = { code: "north", name: "North clinic" },
    page = { limit: 25, offset: 0 };
  it("requires explicit operation and global authority, independently of role names", () => {
    expect(() => service.list(page, { ...actor, permissions: [] })).toThrow(ForbiddenException);
    expect(() => service.create(input, { ...actor, permissions: ["clinics:create"] })).toThrow(ForbiddenException);
    expect(() => service.assign("clinic", "user", { ...actor, permissions: ["clinics:staff-manage"] })).toThrow(
      ForbiddenException
    );
  });
  it("delegates the actor on every catalog and staff operation and handles absence", async () => {
    await expect(service.read("absent", actor)).rejects.toBeInstanceOf(NotFoundException);
    repository.read.mockResolvedValue(input);
    expect(await service.read("clinic", actor)).toBe(input);
    await service.create(input, actor);
    await service.list(page, actor);
    await service.update("clinic", { enabled: false }, actor);
    await service.staff("clinic", page, actor);
    await service.assign("clinic", "user", actor);
    await service.unassign("clinic", "user", actor);
    expect(repository.update).toHaveBeenCalledWith("clinic", { enabled: false }, actor);
    expect(repository.assign).toHaveBeenCalledWith("clinic", "user", actor);
    expect(repository.unassign).toHaveBeenCalledWith("clinic", "user", actor);
  });
});
