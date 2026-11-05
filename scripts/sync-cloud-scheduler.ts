import { loadSecrets } from "../src/infrastructure/config/load-secrets";
import { validateEnvironment } from "../src/infrastructure/config/environment";
import { ConfigService } from "@nestjs/config";
import { GoogleJobScheduler } from "../src/infrastructure/jobs/google-job-scheduler";
/** Explicit provisioning command. Never called by application startup. */
async function main() {
  await loadSecrets();
  const config = new ConfigService(validateEnvironment(process.env));
  const scheduler = new GoogleJobScheduler(config);
  const prevention = process.argv.includes("--prevention");
  const memberships = process.argv.includes("--memberships");
  const id = prevention
    ? config.get("GCP_PREVENTION_SCHEDULE_ID") || "blue-care-prevention-sweep"
    : memberships
      ? config.get("GCP_MEMBERSHIP_SCHEDULE_ID") || "blue-care-memberships-sweep"
      : config.get("GCP_NOTIFICATION_SCHEDULE_ID") || "blue-care-notifications-sweep";
  try {
    if (process.argv.includes("--remove")) await scheduler.remove(id);
    else
      await scheduler.upsert({
        id,
        schedule:
          config.get(
            prevention
              ? "GCP_PREVENTION_SCHEDULE"
              : memberships
                ? "GCP_MEMBERSHIP_SCHEDULE"
                : "GCP_NOTIFICATION_SCHEDULE"
          ) || "* * * * *",
        timeZone: config.get("GCP_SCHEDULER_TIME_ZONE") || "America/Guatemala",
        path: prevention
          ? "/api/v1/internal/jobs/prevention/dispatch"
          : memberships
            ? "/api/v1/internal/jobs/memberships/dispatch"
            : "/api/v1/internal/jobs/notifications/dispatch",
        payload: {}
      });
  } finally {
    await scheduler.onModuleDestroy();
  }
  console.info("Cloud Scheduler configuration applied.");
}
main().catch(() => {
  console.error("Cloud Scheduler configuration failed. Check ADC, IAM and environment settings.");
  process.exitCode = 1;
});
