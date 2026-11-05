import { PushUseCase } from "../src/modules/notifications/application/push.usecase";
import { loadSecrets } from "../src/infrastructure/config/load-secrets";
import { NestFactory } from "@nestjs/core";
import { NotificationsUseCase } from "../src/modules/notifications/application/notifications.usecase";
/** Explicit local worker: process one bounded batch, without starting an HTTP listener. */
async function main() {
  await loadSecrets();
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load configuration only after Secret Manager.
  const { AppModule } = require("../src/app.module") as typeof import("../src/app.module");
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["warn", "error"] });
  try {
    console.info({ email: await app.get(NotificationsUseCase).drain(), push: await app.get(PushUseCase).drain() });
  } finally {
    await app.close();
  }
}
main().catch(() => {
  console.error("Notification batch failed. Check configuration and database migrations.");
  process.exitCode = 1;
});
