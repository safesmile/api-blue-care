import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CloudTasksClient } from "@google-cloud/tasks";
import { JobQueue, type HttpJob } from "../../shared/domain/job-queue";
/** Creates deduplicated tasks using ADC and a fixed, authenticated callback origin. */
@Injectable()
export class GoogleJobQueue extends JobQueue {
  private readonly client = new CloudTasksClient();
  /**
   *
   * @param config Validated application settings.
   */
  constructor(private readonly config: ConfigService) {
    super();
  }
  /**
   *
   * @returns Result of the completed operation.
   */
  private parent() {
    return this.client.queuePath(
      this.config.getOrThrow("GOOGLE_CLOUD_PROJECT"),
      this.config.getOrThrow("GCP_LOCATION"),
      this.config.getOrThrow("GCP_TASKS_QUEUE")
    );
  }
  /**
   * Enqueues only paths within the internal jobs namespace.
   * @param job HTTP task to enqueue.
   * @returns Result of the completed operation.
   */
  async enqueue(job: HttpJob) {
    if (this.config.get("GCP_JOBS_ENABLED") !== "true") return null;
    if (!/^[a-zA-Z0-9_-]{1,500}$/.test(job.id)) throw new Error("Invalid task ID");
    if (!/^\/api\/v1\/internal\/jobs\/[a-zA-Z0-9/-]+$/.test(job.path)) throw new Error("Invalid job path");
    const name = this.parent() + "/tasks/" + job.id;
    const url = new URL(job.path, this.config.getOrThrow<string>("GCP_CALLBACK_URL")).toString();
    try {
      await this.client.createTask({
        parent: this.parent(),
        task: {
          name,
          httpRequest: {
            httpMethod: "POST",
            url,
            headers: { "Content-Type": "application/json" },
            body: Buffer.from(JSON.stringify(job.payload)),
            oidcToken: {
              serviceAccountEmail: this.config.getOrThrow("GCP_JOBS_SERVICE_ACCOUNT"),
              audience: this.config.getOrThrow("GCP_JOBS_AUDIENCE")
            }
          },
          scheduleTime: job.runAt ? { seconds: Math.floor(job.runAt.getTime() / 1000) } : undefined
        }
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 6) throw error;
    }
    return name;
  }
  /**
   * Cancels an existing task; an already absent task is harmless.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  async cancel(id: string) {
    if (this.config.get("GCP_JOBS_ENABLED") !== "true") return;
    if (!/^[a-zA-Z0-9_-]{1,500}$/.test(id)) throw new Error("Invalid task ID");
    try {
      await this.client.deleteTask({ name: this.parent() + "/tasks/" + id });
    } catch (error) {
      if ((error as { code?: number }).code !== 5) throw error;
    }
  }
  /** Closes the underlying Google client when the application stops. */
  async onModuleDestroy() {
    await this.client.close();
  }
}
