import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  MembershipGateway,
  type CheckoutRequest,
  type VerifiedEvent,
  type VerifiedPayment
} from "../domain/membership-billing";
/** Hosted-card integration based on the official unified-intent and Svix contracts. */
@Injectable()
export class RecurrenteGateway extends MembershipGateway {
  /**
   * Recibe las dependencias de la operación.
   * @param config Dependencia tipada de config.
   */
  constructor(private readonly config: ConfigService) {
    super();
  }
  /**
   * Reports whether explicit provider configuration is enabled.
   * @returns The persisted result or completion of the authorized operation.
   */
  available() {
    return this.config.get("RECURRENTE_ENABLED") === "true";
  }
  /**
   * Obtains one durable hosted quote without repeating ambiguous provider creation.
   * @param input Validated operation fields.
   * @returns The persisted result or completion of the authorized operation.
   */
  async checkout(input: CheckoutRequest) {
    const frontend = this.config.getOrThrow<string>("FRONTEND_URL").replace(/\/$/, "");
    const result = await this.request("POST", "/checkouts", {
      items: [
        {
          name: input.name,
          amount_in_cents: input.amountCents,
          currency: "GTQ",
          charge_type: "recurring",
          billing_interval: input.cadence === "annual" ? "year" : "month",
          billing_interval_count: 1,
          quantity: 1,
          payment_method_types: ["card"],
          proration_behavior: "none",
          defer_to_billing_day: false
        }
      ],
      metadata: input.membershipId,
      expires_at: input.expiresAt.toISOString(),
      success_url: frontend + "/membership/checkout/success",
      cancel_url: frontend + "/membership/checkout/cancel"
    });
    if (
      typeof result.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(result.id) ||
      typeof result.checkout_url !== "string"
    )
      throw new ServiceUnavailableException("La respuesta de pago de Recurrente no es válida");
    const url = new URL(result.checkout_url);
    if (
      url.origin !== "https://app.recurrente.com" ||
      url.username ||
      url.password ||
      result.checkout_url.length > 1000
    )
      throw new ServiceUnavailableException("La dirección de pago de Recurrente no es válida");
    return { id: result.id, url: result.checkout_url as string };
  }
  /**
   * Retrieves canonical completed card payment evidence from the provider.
   * @param id Resource identifier.
   * @returns The persisted result or completion of the authorized operation.
   */
  async payment(id: string): Promise<VerifiedPayment | null> {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      throw new ServiceUnavailableException("El identificador del pago de Recurrente no es válido");
    const result = await this.request("GET", "/intents/" + id);
    // Only completed card payments from our own API account are automatically allocated.
    if (
      result.id !== id ||
      result.type !== "payment" ||
      result.status !== "succeeded" ||
      result.raw_status !== "succeeded"
    )
      return null;
    const checkout = result.checkout as Record<string, unknown> | undefined,
      subscription = result.subscription as Record<string, unknown> | undefined;
    if (
      !subscription ||
      typeof subscription.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(subscription.id) ||
      typeof result.created_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(result.created_at)
    )
      return null;
    const paidAt = new Date(result.created_at);
    if (
      !Number.isFinite(paidAt.getTime()) ||
      !Number.isSafeInteger(result.amount_in_cents) ||
      typeof result.currency !== "string" ||
      !/^[A-Z]{3}$/.test(result.currency)
    )
      return null;
    return {
      id,
      amountCents: result.amount_in_cents as number,
      currency: result.currency,
      paidAt,
      subscriptionId: subscription.id,
      checkoutId: typeof checkout?.id === "string" ? checkout.id : null,
      membershipId: typeof checkout?.metadata === "string" ? checkout.metadata : null
    };
  }
  /**
   * Confirms whether a known checkout expired unpaid or references a payment to reconcile.
   * @param id Server-stored checkout identifier.
   * @returns Provider evidence; local expiry alone never proves that no charge occurred.
   */
  async checkoutState(id: string) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      throw new ServiceUnavailableException("El identificador de la solicitud de pago no es válido");
    const result = await this.request("GET", "/checkouts/" + id);
    if (result.id !== id) throw new ServiceUnavailableException("Los datos del pago no coinciden con la solicitud");
    const latest = result.latest_intent as Record<string, unknown> | undefined;
    return {
      expiredUnpaid: result.status === "expired" && !result.payment,
      paymentId:
        result.status === "paid" && typeof latest?.id === "string" && /^in_[a-zA-Z0-9_-]{1,97}$/.test(latest.id)
          ? latest.id
          : null
    };
  }
  /**
   * Confirms provider cancellation or pause and tolerates retries.
   * @param subscriptionId Server-verified provider subscription identifier.
   * @param pause Whether to pause rather than permanently cancel billing.
   */
  async stop(subscriptionId: string, pause: boolean) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(subscriptionId))
      throw new ServiceUnavailableException("El identificador de la suscripción no es válido");
    const current = await this.request("GET", "/subscriptions/" + subscriptionId);
    if (current.status === "cancelled" || (pause && current.status === "paused")) return;
    await this.request(
      pause ? "PUT" : "DELETE",
      "/subscriptions/" + subscriptionId,
      pause ? { act: "pause" } : undefined
    );
  }
  /**
   * Verifies original Svix bytes and timestamp before reading the minimal event envelope.
   * @param body Original provider request bytes.
   * @param headers Provider signature headers.
   * @returns The persisted result or completion of the authorized operation.
   */
  verify(body: Buffer, headers: Record<string, unknown>): VerifiedEvent {
    if (!this.available()) throw new ServiceUnavailableException("La integración con Recurrente está deshabilitada");
    const id = headers["svix-id"],
      timestamp = headers["svix-timestamp"],
      signature = headers["svix-signature"];
    if (
      !Buffer.isBuffer(body) ||
      typeof id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,150}$/.test(id) ||
      typeof timestamp !== "string" ||
      !/^\d{10,12}$/.test(timestamp) ||
      typeof signature !== "string" ||
      signature.length > 2000 ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
    )
      throw new UnauthorizedException("La firma del evento del proveedor no es válida");
    const secret = this.config.getOrThrow<string>("RECURRENTE_WEBHOOK_SECRET");
    const expected = createHmac("sha256", Buffer.from(secret.replace(/^whsec_/, ""), "base64"))
      .update(id + "." + timestamp + ".")
      .update(body)
      .digest();
    const valid = signature.split(" ").some(part => {
      if (!part.startsWith("v1,")) return false;
      const value = Buffer.from(part.slice(3), "base64");
      return value.length === expected.length && timingSafeEqual(value, expected);
    });
    if (!valid) throw new UnauthorizedException("La firma del evento del proveedor no es válida");
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body.toString("utf-8"));
    } catch {
      throw new UnauthorizedException("El contenido JSON del evento del proveedor no es válido");
    }
    if (
      !payload ||
      typeof payload.event_type !== "string" ||
      payload.event_type.length > 100 ||
      typeof payload.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(payload.id)
    )
      throw new UnauthorizedException("La estructura del evento del proveedor no es válida");
    return { id, eventType: payload.event_type, resourceId: payload.id };
  }
  /**
   * Calls the fixed provider origin with bounded timeouts and sanitized errors.
   * @param method Provider API method.
   * @param path Server-selected provider API resource path.
   * @param body Original provider request bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  private async request(method: string, path: string, body?: object): Promise<Record<string, any>> {
    if (!this.available()) throw new ServiceUnavailableException("La integración con Recurrente está deshabilitada");
    try {
      const response = await fetch("https://app.recurrente.com/api" + path, {
        method,
        headers: {
          "X-SECRET-KEY": this.config.getOrThrow<string>("RECURRENTE_SECRET_KEY"),
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
        redirect: "error"
      });
      if (!response.ok) throw new Error("Provider rejected operation");
      if (response.status === 204) return {};
      const result = await response.json();
      if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid provider JSON");
      return result;
    } catch {
      throw new ServiceUnavailableException("No se pudo confirmar la operación con Recurrente");
    }
  }
}
