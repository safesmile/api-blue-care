import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PreventionUseCase } from "../../../modules/prevention/application/prevention.usecase";
import { REGISTERED_PERMISSIONS } from "../../../modules/authorization/infrastructure/permission-registry";
import { userFixture } from "../../helpers/identity.fixture";
describe("PreventionUseCase", () => {
  const repository = {
    types: jest.fn(),
    saveType: jest.fn(),
    create: jest.fn(),
    read: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    complete: jest.fn(),
    cancel: jest.fn(),
    drain: jest.fn()
  };
  const service = new PreventionUseCase(repository),
    actor = { ...userFixture().toView(), permissions: REGISTERED_PERMISSIONS.map(p => p.shortcode) },
    page = { limit: 25, offset: 0 };
  const input = {
    patientId: "patient",
    clinicId: "clinic",
    typeId: "type",
    dueAt: "2030-01-01T12:00:00Z",
    status: "planned" as const,
    intervalMonths: 6,
    reminderHours: [168, 24],
    idempotencyKey: "key"
  };
  it("requires independent administrative grants and ownership is delegated explicitly", async () => {
    const denied = { ...actor, permissions: [] };
    for (const call of [
      () => service.types(page, denied),
      () => service.saveType(null, { code: "cleaning", name: "Cleaning", enabled: true }, denied),
      () => service.create(input, denied),
      () => service.list(page, denied),
      () => service.update("id", { ...input, expectedVersion: 1 }, denied),
      () => service.complete("id", 1, input.dueAt, denied),
      () => service.cancel("id", 1, denied)
    ])
      expect(call).toThrow(ForbiddenException);
    await expect(service.read("id", denied)).rejects.toThrow(ForbiddenException);
    await service.types(page, actor);
    await service.saveType(null, { code: "cleaning", name: "Cleaning", enabled: true }, actor);
    await service.create(input, actor);
    await service.create({ ...input, intervalMonths: null, reminderHours: [] }, actor);
    repository.read
      .mockResolvedValueOnce({ id: "event" })
      .mockResolvedValueOnce({ id: "own" })
      .mockResolvedValueOnce(null);
    expect(await service.read("id", actor)).toEqual({ id: "event" });
    expect(await service.read("id", actor, true)).toEqual({ id: "own" });
    await expect(service.read("missing", actor)).rejects.toThrow(NotFoundException);
    await service.list(page, actor);
    await service.list({ ...page, from: "2026-01-01T00:00:00Z", to: "2027-01-01T00:00:00Z" }, actor, true);
    await service.update("id", { ...input, expectedVersion: 1 }, actor);
    await service.complete("id", 1, input.dueAt, actor);
    await service.cancel("id", 1, actor);
    await service.drain();
    expect(repository.read).toHaveBeenCalledWith("id", actor, true);
    expect(repository.list).toHaveBeenCalledWith(page, actor, false);
  });
  it("rejects ambiguous ranges, patient intervals and duplicate or excessive offsets", () => {
    expect(() => service.list({ ...page, from: input.dueAt, to: input.dueAt }, actor)).toThrow(BadRequestException);
    for (const intervalMonths of [0, 1.5, 121])
      expect(() => service.create({ ...input, intervalMonths }, actor)).toThrow(BadRequestException);
    for (const reminderHours of [[24, 24], [0], [8761], [1.5], Array.from({ length: 11 }, (_v, i) => i + 1)])
      expect(() => service.create({ ...input, reminderHours }, actor)).toThrow(BadRequestException);
  });
});
