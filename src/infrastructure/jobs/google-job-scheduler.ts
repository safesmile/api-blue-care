import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CloudSchedulerClient } from "@google-cloud/scheduler";
import { JobScheduler, type RecurringJob } from "../../shared/domain/job-scheduler";
/** Manages schedules only when explicitly called, never at application startup. */
@Injectable()
export class GoogleJobScheduler extends JobScheduler {
  private readonly client = new CloudSchedulerClient();
  /**
   * Recibe las dependencias de la operación.
   * @param config Dependencia tipada de config.
   */
  constructor(private readonly config: ConfigService) {
    super();
  }
  /**
   *
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  private name(id: string) {
    if (this.config.get("GCP_JOBS_ENABLED") !== "true") throw new Error("Google jobs are disabled");
    if (!/^[a-zA-Z0-9_-]{1,500}$/.test(id)) throw new Error("Invalid scheduler ID");
    return this.client.jobPath(
      this.config.getOrThrow("GOOGLE_CLOUD_PROJECT"),
      this.config.getOrThrow("GCP_LOCATION"),
      id
    );
  }
  /**
   * Creates a missing schedule or updates its complete HTTP configuration.
   * @param input Validated operation input.
   */
  async upsert(input: RecurringJob) {
    const name = this.name(input.id);
    if (!/^\/api\/v1\/internal\/jobs\/[a-zA-Z0-9/-]+$/.test(input.path)) throw new Error("Invalid job path");
    const job = {
      name,
      schedule: input.schedule,
      timeZone: input.timeZone,
      httpTarget: {
        uri: new URL(input.path, this.config.getOrThrow<string>("GCP_CALLBACK_URL")).toString(),
        httpMethod: "POST" as const,
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(JSON.stringify(input.payload)),
        oidcToken: {
          serviceAccountEmail: this.config.getOrThrow<string>("GCP_JOBS_SERVICE_ACCOUNT"),
          audience: this.config.getOrThrow<string>("GCP_JOBS_AUDIENCE")
        }
      }
    };
    try {
      await this.client.updateJob({ job, updateMask: { paths: ["schedule", "time_zone", "http_target"] } });
    } catch (error) {
      if ((error as { code?: number }).code !== 5) throw error;
      await this.client.createJob({ parent: name.slice(0, name.lastIndexOf("/jobs/")), job });
    }
  }
  /**
   * Removes a schedule without failing for a missing resource.
   * @param id Resource identifier.
   */
  async remove(id: string) {
    try {
      await this.client.deleteJob({ name: this.name(id) });
    } catch (error) {
      if ((error as { code?: number }).code !== 5) throw error;
    }
  }
  /** Closes the underlying Google client when the application stops. */
  async onModuleDestroy() {
    await this.client.close();
  }
}
