import { ConfigService } from "@nestjs/config";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PushUseCase } from "../../helpers/usecases/PushUseCase";
import { userFixture } from "../../helpers/identity.fixture";
describe("PushUseCase", () => {
  const repository = {
      register: jest.fn(),
      list: jest.fn(),
      remove: jest.fn(),
      pending: jest.fn(),
      claim: jest.fn(),
      finish: jest.fn()
    },
    sender = { available: jest.fn(), send: jest.fn() },
    config = new ConfigService({ NOTIFICATION_MAX_ATTEMPTS: "3" });
  const service = new PushUseCase(repository, sender, config),
    actor = { ...userFixture().toView(), permissions: ["notifications:devices" as const] },
    input = { token: "device-token-example-value", platform: "web" as const };
  beforeEach(() => jest.clearAllMocks());
  it("uses the authenticated owner and never accepts recipient identifiers", async () => {
    expect(() => service.register(input, { ...actor, permissions: [] })).toThrow(ForbiddenException);
    expect(() => service.list({ limit: 25, offset: 0 }, { ...actor, permissions: [] })).toThrow(ForbiddenException);
    await expect(service.remove("id", { ...actor, permissions: [] })).rejects.toThrow(ForbiddenException);
    await service.register(input, actor);
    await service.list({ limit: 25, offset: 0 }, actor);
    repository.remove.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await expect(service.remove("missing", actor)).rejects.toThrow(NotFoundException);
    await service.remove("id", actor);
    expect(repository.register).toHaveBeenCalledWith(actor.id, input);
  });
  it("keeps disabled work pending and handles sent, invalid, transient and already claimed deliveries", async () => {
    sender.available.mockReturnValue(false);
    expect(await service.drain()).toEqual({ sent: 0 });
    expect(repository.pending).not.toHaveBeenCalled();
    sender.available.mockReturnValue(true);
    repository.pending.mockResolvedValue(["one", "two", "three", "busy"]);
    repository.claim
      .mockResolvedValueOnce({ id: "one" })
      .mockResolvedValueOnce({ id: "two" })
      .mockResolvedValueOnce({ id: "three" })
      .mockResolvedValueOnce(null);
    sender.send
      .mockResolvedValueOnce("sent")
      .mockResolvedValueOnce("invalid")
      .mockRejectedValueOnce(new Error("provider secret"));
    expect(await service.drain()).toEqual({ sent: 1 });
    expect(repository.finish).toHaveBeenCalledWith({ id: "three" }, "retry", 3);
  });
  it("bounds batches and falls back to the standard attempt limit", async () => {
    sender.available.mockReturnValue(true);
    repository.pending.mockResolvedValue(["due"]);
    repository.claim.mockResolvedValue({ id: "due" });
    sender.send.mockResolvedValue("sent");
    const fallback = new PushUseCase(repository, sender, new ConfigService());
    await fallback.drain();
    expect(repository.finish).toHaveBeenCalledWith({ id: "due" }, "sent", 5);
    const time = jest.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValueOnce(30001);
    expect(await service.drain()).toEqual({ sent: 0 });
    time.mockRestore();
  });
});
