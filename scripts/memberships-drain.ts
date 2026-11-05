import { loadSecrets } from "../src/infrastructure/config/load-secrets";
import { NestFactory } from "@nestjs/core";
import { MembershipsUseCase } from "../src/modules/memberships/application/memberships.usecase";
/** Runs one bounded provider inbox/billing outbox batch without starting an HTTP server. */
async function main() {
  await loadSecrets();
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Read configuration before loading Nest.
  const { AppModule } = require("../src/app.module") as typeof import("../src/app.module");
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["warn", "error"] });
  try {
    console.info(await app.get(MembershipsUseCase).drain());
  } finally {
    await app.close();
  }
}
main().catch(() => {
  console.error("Membership billing batch failed; inspect configuration and persisted job status.");
  process.exitCode = 1;
});
