import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import { RecurrenteGateway } from "../../../modules/memberships/infrastructure/recurrente-gateway";
describe("RecurrenteGateway", () => {
  const secret = "whsec_" + Buffer.from("test-signing-key-only-32-bytes!!!").toString("base64");
  const gateway = new RecurrenteGateway(
    new ConfigService({
      RECURRENTE_ENABLED: "true",
      RECURRENTE_SECRET_KEY: "sk_test_fixture_only",
      RECURRENTE_WEBHOOK_SECRET: secret,
      FRONTEND_URL: "http://localhost:5173"
    })
  );
  let network: jest.SpyInstance;
  const headers = (body: string, timestamp = String(Math.floor(Date.now() / 1000))) => ({
    "svix-id": "message",
    "svix-timestamp": timestamp,
    "svix-signature":
      "v1," +
      createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
        .update("message." + timestamp + "." + body)
        .digest("base64")
  });
  const response = (value: object, status = 200) => ({ ok: status < 400, status, json: async () => value }) as Response;
  beforeEach(() => {
    network = jest.spyOn(global, "fetch").mockRejectedValue(new Error("No real provider calls in tests"));
  });
  afterEach(() => {
    network.mockRestore();
  });
  it("verifies raw payloads, timestamps, signatures and a bounded minimal envelope", () => {
    const body = '{ "id":"in_test", "event_type":"intent.succeeded" }';
    expect(gateway.verify(Buffer.from(body), headers(body))).toEqual({
      id: "message",
      resourceId: "in_test",
      eventType: "intent.succeeded"
    });
    expect(() => gateway.verify(Buffer.from(body + " "), headers(body))).toThrow();
    expect(() => gateway.verify(Buffer.from(body), headers(body, "1000000000"))).toThrow();
    expect(() => gateway.verify(Buffer.from(body), { ...headers(body), "svix-signature": "v1,AA==" })).toThrow();
    expect(() => gateway.verify(Buffer.from("bad"), headers("bad"))).toThrow();
    expect(() => gateway.verify(Buffer.from("null"), headers("null"))).toThrow();
    expect(() => gateway.verify(Buffer.from("{}"), headers("{}"))).toThrow();
  });
  it("fails closed when disabled and never calls the network", async () => {
    const disabled = new RecurrenteGateway(new ConfigService({}));
    expect(disabled.available()).toBe(false);
    expect(() => disabled.verify(Buffer.from("{}"), {})).toThrow();
    await expect(disabled.payment("in_test")).rejects.toThrow();
    expect(network).not.toHaveBeenCalled();
  });
  it("creates exactly configured GTQ recurring hosted quotes without client URLs or price overrides", async () => {
    network.mockResolvedValue(
      response({ id: "ch_test", checkout_url: "https://app.recurrente.com/checkout-session/ch_test" }, 201)
    );
    const result = await gateway.checkout({
      membershipId: "membership",
      name: "Blue Care +",
      amountCents: 100000,
      cadence: "annual",
      expiresAt: new Date("2030-01-01")
    });
    expect(result.id).toBe("ch_test");
    const [url, options] = network.mock.calls[0];
    expect(url).toBe("https://app.recurrente.com/api/checkouts");
    expect(JSON.parse(options.body)).toMatchObject({
      metadata: "membership",
      items: [
        {
          amount_in_cents: 100000,
          billing_interval: "year",
          currency: "GTQ",
          charge_type: "recurring",
          payment_method_types: ["card"]
        }
      ]
    });
    network.mockResolvedValue(response({ id: "ch_test", checkout_url: "https://attacker.example/checkout" }, 201));
    await expect(
      gateway.checkout({
        membershipId: "membership",
        name: "Plan",
        amountCents: 10000,
        cadence: "monthly",
        expiresAt: new Date()
      })
    ).rejects.toThrow();
  });
  it("queries its own account before accepting a completed unified card payment", async () => {
    network.mockResolvedValue(
      response({
        id: "in_test",
        type: "payment",
        status: "succeeded",
        raw_status: "succeeded",
        amount_in_cents: 10000,
        currency: "GTQ",
        created_at: "2026-11-04T18:00:00Z",
        subscription: { id: "su_test" },
        checkout: { id: "ch_test", metadata: "membership" }
      })
    );
    expect(await gateway.payment("in_test")).toMatchObject({
      amountCents: 10000,
      checkoutId: "ch_test",
      membershipId: "membership",
      subscriptionId: "su_test"
    });
    network.mockResolvedValue(response({ id: "in_test", type: "payment", status: "pending" }));
    expect(await gateway.payment("in_test")).toBeNull();
    await expect(gateway.payment("../account")).rejects.toThrow();
  });
  it("makes stop and pause retries safe and hides provider errors", async () => {
    network.mockResolvedValueOnce(response({ status: "active" })).mockResolvedValueOnce(response({ message: "done" }));
    await gateway.stop("su_test", false);
    expect(network.mock.calls[1][1].method).toBe("DELETE");
    network.mockResolvedValueOnce(response({ status: "active" })).mockResolvedValueOnce(response({ status: "paused" }));
    await gateway.stop("su_test", true);
    expect(JSON.parse(network.mock.calls[3][1].body)).toEqual({ act: "pause" });
    network.mockResolvedValue(response({ status: "cancelled" }));
    await gateway.stop("su_test", false);
    network.mockResolvedValue(response({ secret: "must-not-leak" }, 401));
    await expect(gateway.stop("su_test", false)).rejects.toThrow("Recurrente operation could not be confirmed");
  });
  it("uses provider checkout evidence rather than elapsed local time to close unpaid quotes", async () => {
    network.mockResolvedValue(response({ id: "ch_test", status: "expired", payment: null }));
    expect(await gateway.checkoutState("ch_test")).toEqual({ expiredUnpaid: true, paymentId: null });
    network.mockResolvedValue(
      response({ id: "ch_test", status: "paid", latest_intent: { id: "in_settled" }, payment: { id: "pa_settled" } })
    );
    expect(await gateway.checkoutState("ch_test")).toEqual({ expiredUnpaid: false, paymentId: "in_settled" });
    network.mockResolvedValue(response({ id: "ch_test", status: "payment_in_progress" }));
    expect((await gateway.checkoutState("ch_test")).expiredUnpaid).toBe(false);
  });
});
