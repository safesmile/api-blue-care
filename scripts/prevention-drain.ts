import { loadSecrets } from "../src/infrastructure/config/load-secrets";
import { NestFactory } from "@nestjs/core";
import { DrainPreventionEventUseCase } from "../src/modules/prevention/application/drainPreventionEvent.usecase";
/** Generates one bounded batch of preventive reminders without starting an HTTP server. */
async function main() {
  await loadSecrets();
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Read configuration before loading Nest.
  const { AppModule } = require("../src/app.module") as typeof import("../src/app.module");
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["warn", "error"] });
  try {
    console.info(await app.get(DrainPreventionEventUseCase).execute());
  } finally {
    await app.close();
  }
}
main().catch(() => {
  console.error("Preventive reminder batch failed; inspect configuration and persisted job status.");
  process.exitCode = 1;
});
