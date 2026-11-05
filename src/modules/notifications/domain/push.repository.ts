import type { Pagination, Page } from "../../../shared/domain/crud.repository";
export interface PushDeviceInput {
  token: string;
  platform: "web" | "android" | "ios";
}
export interface PushDevice {
  id: string;
  platform: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface PushDelivery {
  id: string;
  lease: string;
  deviceId: string;
  token: string;
  notificationId: string;
  title: string;
  body: string;
  attempts: number;
}
/** Provider-independent push transport; no browser or device SDK runs on the API. */
export abstract class PushSender {
  /**
   * Reports whether the push provider is explicitly enabled.
   */
  abstract available(): boolean;
  /**
   * Sends a generic notification through FCM using ADC.
   * @param delivery Explicit delivery value for this operation.
   */
  abstract send(delivery: PushDelivery): Promise<"sent" | "invalid">;
}
/** Durable per-device outbox and owner-only registrations. */
export abstract class PushRepository {
  /**
   * Registers the authenticated owner device without returning its token.
   * @param userId Explicit userId value for this operation.
   * @param input Validated operation fields.
   */
  abstract register(userId: string, input: PushDeviceInput): Promise<PushDevice>;
  /**
   * Lists bounded records within the current ownership scope.
   * @param userId Explicit userId value for this operation.
   * @param page Bounded pagination values.
   */
  abstract list(userId: string, page: Pagination): Promise<Page<PushDevice>>;
  /**
   * Disables only a device belonging to the authenticated owner.
   * @param userId Explicit userId value for this operation.
   * @param id Resource identifier.
   */
  abstract remove(userId: string, id: string): Promise<boolean>;
  /**
   * Finds due deliveries whose leases are available.
   */
  abstract pending(): Promise<string[]>;
  /**
   * Claims a single delivery after revalidating its owner and source.
   * @param id Resource identifier.
   */
  abstract claim(id: string): Promise<PushDelivery | null>;
  /**
   * Commits the leased outcome and the durable retry delay.
   * @param delivery Explicit delivery value for this operation.
   * @param outcome Explicit outcome value for this operation.
   * @param maxAttempts Explicit maxAttempts value for this operation.
   */
  abstract finish(delivery: PushDelivery, outcome: "sent" | "invalid" | "retry", maxAttempts: number): Promise<void>;
}
