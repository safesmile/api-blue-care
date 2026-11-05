export interface RecurringJob {
  id: string;
  schedule: string;
  timeZone: string;
  path: string;
  payload: Record<string, unknown>;
}
/** Port for explicitly provisioned recurring HTTP jobs. */
export abstract class JobScheduler {
  abstract upsert(job: RecurringJob): Promise<void>;
  abstract remove(id: string): Promise<void>;
}
