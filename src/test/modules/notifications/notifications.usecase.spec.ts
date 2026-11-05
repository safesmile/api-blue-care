import { ConfigService } from "@nestjs/config";
import { NotificationsUseCase } from "../../../modules/notifications/application/notifications.usecase";
describe("NotificationsUseCase", () => {
  const repository = {
    create: jest.fn(),
    list: jest.fn(),
    markRead: jest.fn(),
    cancel: jest.fn(),
    pending: jest.fn(),
    claim: jest.fn(),
    finish: jest.fn()
  };
  const jobs = { enqueue: jest.fn(), cancel: jest.fn() };
  const mail = { send: jest.fn() };
  const service = new NotificationsUseCase(repository, jobs, mail, new ConfigService({}));
  const input = {
    key: "membership:renewed:1",
    userId: "user",
    title: "Renovación",
    body: "Membresía renovada",
    email: true
  };
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it("persists before enqueue, retaining the notification if Google is unavailable", async () => {
    repository.create.mockResolvedValue({ id: "inbox", deliveryId: "delivery" });
    jobs.enqueue.mockRejectedValue(new Error("unavailable"));
    expect(await service.notify(input)).toBe("inbox");
    expect(jobs.enqueue).toHaveBeenCalledWith(expect.objectContaining({ payload: { id: "delivery" } }));
  });
  it("enqueues scheduled deliveries and supports inbox-only entries", async () => {
    repository.create
      .mockResolvedValueOnce({ id: "inbox", deliveryId: "delivery" })
      .mockResolvedValueOnce({ id: "inbox", deliveryId: null });
    await service.notify({ ...input, deliverAt: new Date() });
    await service.notify(input);
    expect(jobs.enqueue).toHaveBeenCalledTimes(1);
  });
  it.each([
    { key: "" },
    { key: "x".repeat(201) },
    { title: "" },
    { title: "x".repeat(201) },
    { body: "" },
    { body: "x".repeat(10001) }
  ])("rejects invalid content %j", async patch => {
    await expect(service.notify({ ...input, ...patch })).rejects.toThrow("Invalid notification");
    expect(repository.create).not.toHaveBeenCalled();
  });
  it("forwards owner-scoped inbox operations and rejects a missing notification", async () => {
    await service.list("owner", 25, 0);
    expect(repository.list).toHaveBeenCalledWith("owner", 25, 0);
    repository.markRead.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await service.markRead("owner", "id");
    await expect(service.markRead("owner", "other")).rejects.toThrow("Notification not found");
    await service.cancel("owner", "event");
    expect(repository.cancel).toHaveBeenCalledWith("owner", "event");
  });
  it("acknowledges terminal jobs but asks for retry on busy or not-yet-due work", async () => {
    repository.claim.mockResolvedValueOnce("done").mockResolvedValueOnce(null);
    expect(await service.deliver("id")).toBe(true);
    expect(await service.deliver("id")).toBe(false);
    expect(mail.send).not.toHaveBeenCalled();
  });
  it("records successes, transport failures and configured attempt limits", async () => {
    const delivery = { id: "id", lease: "lease", attempts: 2, email: "a@blue.test", title: "Title", body: "Body" };
    repository.claim.mockResolvedValue(delivery);
    expect(await service.deliver("id")).toBe(true);
    expect(repository.finish).toHaveBeenLastCalledWith(delivery, true, 5);
    mail.send.mockRejectedValue(new Error("SMTP unavailable"));
    const configured = new NotificationsUseCase(
      repository,
      jobs,
      mail,
      new ConfigService({ NOTIFICATION_MAX_ATTEMPTS: "3" })
    );
    expect(await configured.deliver("id")).toBe(false);
    expect(repository.finish).toHaveBeenLastCalledWith(delivery, false, 3);
  });
  it("recovers pending jobs with bounded batches", async () => {
    repository.pending.mockResolvedValue(["done", "busy"]);
    repository.claim.mockResolvedValueOnce("done").mockResolvedValueOnce(null);
    expect(await service.drain()).toEqual({ sent: 1 });
  });
  it("stops starting new deliveries when the recovery time budget expires", async () => {
    repository.pending.mockResolvedValue(["pending"]);
    const now = jest.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(31000);
    try {
      expect(await service.drain()).toEqual({ sent: 0 });
    } finally {
      now.mockRestore();
    }
  });
});
