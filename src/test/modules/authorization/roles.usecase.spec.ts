import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { RolesUseCase } from "../../helpers/usecases/RolesUseCase";
import { REGISTERED_PERMISSIONS } from "../../../modules/authorization/infrastructure/permission-registry";
import { userFixture } from "../../helpers/identity.fixture";
describe("RolesUseCase", () => {
  const repository = {
    list: jest.fn(),
    read: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    catalog: jest.fn(),
    clinicAssignable: jest.fn(),
    authorizeAssignment: jest.fn()
  };
  const useCase = new RolesUseCase(repository);
  const actor = { ...userFixture().toView(), permissions: REGISTERED_PERMISSIONS.map(p => p.shortcode) };
  const input = { name: "reception", description: "Reception", permissions: ["auth:me"] as ["auth:me"] };
  it("requires operation authority independently of the HTTP guard", () => {
    expect(() => useCase.list({ limit: 25, offset: 0 }, { ...actor, permissions: [] })).toThrow(ForbiddenException);
  });
  it("delegates explicit operations and returns a missing role as 404", async () => {
    await useCase.list({ limit: 25, offset: 0 }, actor);
    await expect(useCase.read("missing", actor)).rejects.toBeInstanceOf(NotFoundException);
    repository.read.mockResolvedValue(input);
    expect(await useCase.read("role", actor)).toBe(input);
    await useCase.create(input, actor);
    await useCase.update("role", input, actor);
    await useCase.delete("role", actor);
    await useCase.catalog(actor);
    expect(repository.update).toHaveBeenCalledWith("role", input, actor);
    expect(repository.delete).toHaveBeenCalledWith("role", actor);
  });
});
