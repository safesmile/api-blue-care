import { loadSecrets } from "../src/infrastructure/config/load-secrets";
import { validateEnvironment } from "../src/infrastructure/config/environment";
import { CloudTasksClient } from "@google-cloud/tasks";
/** Explicit, idempotent provisioning of the configured notification queue. */
async function main() {
  await loadSecrets();
  const env = validateEnvironment(process.env);
  if (env.GCP_JOBS_ENABLED !== "true") throw new Error("Jobs are disabled");
  const client = new CloudTasksClient();
  const name = client.queuePath(
    String(env.GOOGLE_CLOUD_PROJECT),
    String(env.GCP_LOCATION),
    String(env.GCP_TASKS_QUEUE)
  );
  try {
    try {
      await client.getQueue({ name });
    } catch (error) {
      if (error.code !== 5) throw error;
      try {
        await client.createQueue({
          parent: client.locationPath(String(env.GOOGLE_CLOUD_PROJECT), String(env.GCP_LOCATION)),
          queue: {
            name,
            rateLimits: { maxConcurrentDispatches: 5, maxDispatchesPerSecond: 5 },
            retryConfig: { maxAttempts: 20, minBackoff: { seconds: 30 }, maxBackoff: { seconds: 3600 } }
          }
        });
      } catch (createError) {
        if (createError.code !== 6) throw createError;
      }
    }
    console.info("Cloud Tasks queue is available; existing queue settings were preserved.");
  } finally {
    await client.close();
  }
}
main().catch(() => {
  console.error("Queue setup failed. Check ADC, IAM and environment settings.");
  process.exitCode = 1;
});
