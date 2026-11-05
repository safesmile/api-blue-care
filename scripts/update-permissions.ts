import { databaseOptions } from "../database/connection";
import "dotenv/config";
import { Sequelize } from "sequelize";
import { syncPermissions } from "../src/modules/authorization/infrastructure/sync-permissions";
import { loadSecrets } from "../src/infrastructure/config/load-secrets";
/** Synchronizes the permission catalog without starting the HTTP server. */
async function main() {
  await loadSecrets();
  if (process.argv.length > 2) throw new Error("Este comando solo sincroniza permisos y roles; no recibe argumentos");
  const db = new Sequelize(databaseOptions());
  try {
    await syncPermissions(db);
    console.info("Permissions and default roles synchronized");
  } finally {
    await db.close();
  }
}
main().catch(error => {
  console.error("Permission synchronization failed:", error.message);
  process.exitCode = 1;
});
