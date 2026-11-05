export interface NotificationInput {
  /** Stable business event key, unique per recipient. Never a token or secret. */
  key: string;
  userId: string;
  title: string;
  body: string;
  email?: boolean;
  push?: boolean;
  deliverAt?: Date;
}
export interface InboxNotification {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}
export interface Delivery {
  id: string;
  lease: string;
  attempts: number;
  email: string;
  title: string;
  body: string;
}
/** Persistence boundary for the inbox and durable email outbox. */
export abstract class NotificationRepository {
  abstract create(input: NotificationInput): Promise<{ id: string; deliveryId: string | null }>;
  abstract list(userId: string, limit: number, offset: number): Promise<{ items: InboxNotification[]; total: number }>;
  abstract markRead(userId: string, id: string): Promise<boolean>;
  abstract pending(): Promise<string[]>;
  abstract claim(id: string): Promise<Delivery | "done" | null>;
  abstract finish(delivery: Delivery, success: boolean, maxAttempts: number): Promise<void>;
  abstract cancel(userId: string, key: string): Promise<void>;
}
