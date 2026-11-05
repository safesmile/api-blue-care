import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AuditUseCase } from "../../../modules/audit/application/audit.usecase";
import { userFixture } from "../../helpers/identity.fixture";
describe("AuditUseCase", () => {
  const repository = { list: jest.fn(), read: jest.fn() },
    audit = new AuditUseCase(repository);
  const actor = {
    ...userFixture().toView(),
    permissions: ["audit:list", "audit:read"] as ["audit:list", "audit:read"]
  };
  beforeEach(() => jest.resetAllMocks());
  it("requires explicit audit permissions rather than a role name", async () => {
    expect(() => audit.list({ limit: 25, offset: 0 }, { ...actor, roles: ["superadmin"], permissions: [] })).toThrow(
      ForbiddenException
    );
    await expect(audit.read("id", { ...actor, permissions: [] })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("lists bounded filters, rejects reversed dates and reports missing records", async () => {
    await audit.list({ limit: 25, offset: 0 }, actor);
    await audit.list({ limit: 1, offset: 0, from: "2026-11-01T00:00:00Z" }, actor);
    await audit.list({ limit: 1, offset: 0, from: "2026-11-01T00:00:00Z", to: "2026-11-03T00:00:00Z" }, actor);
    expect(() =>
      audit.list({ limit: 1, offset: 0, from: "2026-11-03T00:00:00Z", to: "2026-11-01T00:00:00Z" }, actor)
    ).toThrow(BadRequestException);
    repository.read.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "id" });
    await expect(audit.read("id", actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(await audit.read("id", actor)).toEqual({ id: "id" });
  });
});
