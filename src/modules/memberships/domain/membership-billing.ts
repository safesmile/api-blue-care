export interface CheckoutRequest {
  membershipId: string;
  name: string;
  amountCents: number;
  cadence: "monthly" | "annual";
  expiresAt: Date;
}
export interface VerifiedPayment {
  id: string;
  amountCents: number;
  currency: string;
  paidAt: Date;
  checkoutId: string | null;
  subscriptionId: string;
  membershipId: string | null;
}
export interface VerifiedEvent {
  id: string;
  eventType: string;
  resourceId: string;
}
/** External billing boundary; disabled installations cannot create charges or verify payment claims. */
export abstract class MembershipGateway {
  abstract available(): boolean;
  abstract checkout(input: CheckoutRequest): Promise<{ id: string; url: string }>;
  abstract payment(id: string): Promise<VerifiedPayment | null>;
  abstract checkoutState(id: string): Promise<{ expiredUnpaid: boolean; paymentId: string | null }>;
  abstract stop(subscriptionId: string, pause: boolean): Promise<void>;
  abstract verify(body: Buffer, headers: Record<string, unknown>): VerifiedEvent;
}
/** Durable provider work. Implementations never call the provider inside a business transaction. */
export abstract class MembershipBilling {
  abstract checkout(id: string): Promise<{ id: string; url: string }>;
  abstract receive(event: VerifiedEvent): Promise<void>;
  abstract drain(): Promise<{ payments: number; commands: number }>;
}
