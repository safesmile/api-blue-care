export interface HttpJob {
  id: string;
  path: string;
  payload: Record<string, unknown>;
  runAt?: Date;
}
/** Durable HTTP task provider; disabled mode never pretends to enqueue. */
export abstract class JobQueue {
  abstract enqueue(job: HttpJob): Promise<string | null>;
  abstract cancel(id: string): Promise<void>;
}
