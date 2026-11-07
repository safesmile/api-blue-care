import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { MembershipsUseCase } from "../../helpers/usecases/MembershipsUseCase";
import { REGISTERED_PERMISSIONS } from "../../../modules/authorization/infrastructure/permission-registry";
import { userFixture } from "../../helpers/identity.fixture";
describe("MembershipsUseCase", () => {
  const repository = {
    create: jest.fn(),
    read: jest.fn(),
    list: jest.fn(),
    cancel: jest.fn(),
    suspend: jest.fn(),
    periods: jest.fn()
  };
  const patients = {
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
  const billing = { checkout: jest.fn(), receive: jest.fn(), drain: jest.fn() },
    gateway = {
      available: jest.fn(),
      checkout: jest.fn(),
      payment: jest.fn(),
      checkoutState: jest.fn(),
      stop: jest.fn(),
      verify: jest.fn()
    };
  const service = new MembershipsUseCase(repository, patients, billing, gateway),
    actor = { ...userFixture().toView(), permissions: REGISTERED_PERMISSIONS.map(p => p.shortcode) },
    page = { limit: 25, offset: 0 };
  const input = { patientId: "patient", planVersionId: "version", cadence: "monthly" as const };
  it("requires operation permission and a real own patient instead of accepting arbitrary identity", async () => {
    expect(() => service.create(input, { ...actor, permissions: [] })).toThrow(ForbiddenException);
    await expect(service.createOwn(input, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(() => service.create({ ...input, cadence: "invalid" as "monthly" }, actor)).toThrow(BadRequestException);
    await expect(service.read("missing", actor)).rejects.toBeInstanceOf(NotFoundException);
  });
  it("delegates own/admin operations and consumes only verified event envelopes", async () => {
    repository.read.mockResolvedValue(input);
    patients.own.mockResolvedValue({ id: "persisted-patient" });
    await service.create(input, actor);
    await service.createOwn({ planVersionId: "version", cadence: "annual" }, actor);
    await service.read("contract", actor);
    await service.read("contract", actor, true);
    await service.list(page, actor);
    await service.list(page, actor, true);
    await service.cancel("contract", actor);
    await service.cancel("contract", actor, true);
    await service.suspend("contract", actor);
    await service.periods("contract", page, actor);
    await service.periods("contract", page, actor, true);
    await service.checkout("contract", actor);
    await service.drain();
    const event = { id: "message", eventType: "intent.succeeded", resourceId: "in_payment" };
    gateway.verify.mockReturnValue(event);
    const body = Buffer.from("{}"),
      headers = { "svix-id": "message" };
    await service.receive(body, headers);
    expect(repository.create).toHaveBeenCalledWith(
      { planVersionId: "version", cadence: "annual", patientId: "persisted-patient" },
      actor,
      true
    );
    expect(repository.cancel).toHaveBeenCalledWith("contract", actor, true);
    expect(gateway.verify).toHaveBeenCalledWith(body, headers);
    expect(billing.receive).toHaveBeenCalledWith(event);
  });
});
