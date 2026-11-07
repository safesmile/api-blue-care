import { DrainPushUseCase } from "../src/modules/notifications/application/drainPush.usecase";
import { loadSecrets } from "../src/infrastructure/config/load-secrets";
import { NestFactory } from "@nestjs/core";
import { DrainNotificationUseCase } from "../src/modules/notifications/application/drainNotification.usecase";
/** Explicit local worker: process one bounded batch, without starting an HTTP listener. */
async function main() {
  await loadSecrets();
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load configuration only after Secret Manager.
  const { AppModule } = require("../src/app.module") as typeof import("../src/app.module");
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["warn", "error"] });
  try {
    console.info({
      email: await app.get(DrainNotificationUseCase).execute(),
      push: await app.get(DrainPushUseCase).execute()
    });
  } finally {
    await app.close();
  }
}
main().catch(() => {
  console.error("Notification batch failed. Check configuration and database migrations.");
  process.exitCode = 1;
});
