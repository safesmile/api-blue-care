import { Test } from "@nestjs/testing";
import { Sequelize } from "sequelize-typescript";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../app.module";
import { EmailSender } from "../../shared/domain/email-sender";
import { NotificationRepository } from "../../modules/notifications/domain/notification.repository";
import { NotificationsUseCase } from "../helpers/usecases/NotificationsUseCase";
import type { Delivery } from "../../modules/notifications/domain/notification.repository";
describe("Durable notification delivery (disposable PostgreSQL)", () => {
  let app,
    db: Sequelize,
    repository: NotificationRepository,
    notifications: ReturnType<typeof NotificationsUseCase.resolve>;
  const owner = randomUUID(),
    other = randomUUID(),
    send = jest.fn();
  beforeAll(async () => {
    if (process.env.BLUE_DENT_TEST_DATABASE !== "disposable") throw new Error("Disposable database required");
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailSender)
      .useValue({ send })
      .compile();
    app = module.createNestApplication();
    await app.init();
    db = app.get(Sequelize);
    repository = app.get(NotificationRepository);
    notifications = NotificationsUseCase.resolve(app);
    for (const id of [owner, other])
      await db.query(
        `INSERT INTO users
      (id, email, name, "firstName", "lastName", "passwordHash", enabled, verified, "createdAt", "updatedAt")
      VALUES (:id, :email, 'Test', 'Test', '', 'unused', true, true, NOW(), NOW())`,
        { replacements: { id, email: id + "@blue.test" } }
      );
  }, 30000);
  afterAll(async () => {
    if (db) await db.query("DELETE FROM users WHERE id IN (:ids)", { replacements: { ids: [owner, other] } });
    if (app) await app.close();
  });
  it("deduplicates concurrent business events and isolates inbox ownership", async () => {
    const input = { userId: owner, key: "renewal:1", title: "Renewed", body: "Membership renewed", email: true };
    const entries = await Promise.all([repository.create(input), repository.create(input)]);
    expect(entries[0]).toEqual(entries[1]);
    expect((await repository.list(owner, 25, 0)).total).toBe(1);
    expect((await repository.list(other, 25, 0)).total).toBe(0);
    expect(await repository.markRead(other, entries[0].id)).toBe(false);
    expect(await repository.markRead(owner, entries[0].id)).toBe(true);
    expect(await repository.markRead(owner, entries[0].id)).toBe(true);
  });
  it("leases to one worker, recovers expired leases and rejects stale completion", async () => {
    const record = await repository.create({
      userId: owner,
      key: "concurrent",
      title: "Title",
      body: "Body",
      email: true
    });
    const claims = await Promise.all([repository.claim(record.deliveryId!), repository.claim(record.deliveryId!)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const old = claims.find(Boolean) as Delivery;
    await db.query("UPDATE notification_deliveries SET \"leasedUntil\" = NOW() - INTERVAL '1 minute' WHERE id = :id", {
      replacements: { id: old.id }
    });
    const current = (await repository.claim(old.id)) as Delivery;
    expect(current.lease).not.toBe(old.lease);
    await repository.finish(old, true, 5);
    expect(await repository.claim(old.id)).toBeNull();
    await repository.finish(current, true, 5);
    expect(await repository.claim(old.id)).toBe("done");
  });
  it("persists retry delays, exhausted failures and cancellation", async () => {
    const record = await repository.create({
      userId: owner,
      key: "failure",
      title: "Title",
      body: "Body",
      email: true
    });
    const claim = (await repository.claim(record.deliveryId!)) as Delivery;
    await repository.finish(claim, false, 2);
    expect(await repository.claim(claim.id)).toBeNull();
    await db.query('UPDATE notification_deliveries SET "nextAttemptAt" = NOW() WHERE id = :id', {
      replacements: { id: claim.id }
    });
    const retry = (await repository.claim(claim.id)) as Delivery;
    expect(retry.attempts).toBe(2);
    await repository.finish(retry, false, 2);
    expect(await repository.claim(claim.id)).toBe("done");
    const cancel = await repository.create({ userId: owner, key: "cancel", title: "Title", body: "Body", email: true });
    await repository.cancel(other, "cancel");
    await repository.cancel(owner, "cancel");
    expect(await repository.claim(cancel.deliveryId!)).toBe("done");
  });
  it("delays future notifications and sends only current verified contacts", async () => {
    const future = await repository.create({
      userId: owner,
      key: "future",
      title: "Future",
      body: "Body",
      email: true,
      deliverAt: new Date(Date.now() + 86400000)
    });
    expect(await repository.claim(future.deliveryId!)).toBeNull();
    expect((await repository.list(owner, 100, 0)).items.some(n => n.id === future.id)).toBe(false);
    const record = await repository.create({
      userId: other,
      key: "email-change",
      title: "Title",
      body: "Body",
      email: true
    });
    await db.query("UPDATE users SET email = :email WHERE id = :id", {
      replacements: { email: randomUUID() + "@blue.test", id: other }
    });
    expect(await repository.claim(record.deliveryId!)).toBe("done");
    send.mockResolvedValue(undefined);
    const id = await notifications.notify({ userId: owner, key: "service", title: "Title", body: "Body", email: true });
    expect(id).toBeTruthy();
    await notifications.drain();
    expect(send).toHaveBeenCalled();
  });
  it("rejects unauthenticated inbox and forged Google headers even in development", async () => {
    await request(app.getHttpServer()).get("/notifications").expect(401);
    await request(app.getHttpServer())
      .post("/internal/jobs/notifications/dispatch")
      .set("X-CloudScheduler", "true")
      .expect(401);
  });
});
