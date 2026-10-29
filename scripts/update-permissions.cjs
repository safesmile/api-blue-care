require("ts-node").register({ transpileOnly: true });
require("dotenv").config();
const { Sequelize } = require("sequelize");
const { syncPermissions } = require("../src/modules/authorization/infrastructure/sync-permissions");
const { loadSecrets } = require("../src/infrastructure/config/load-secrets");
/** Synchronizes the permission catalog without starting the HTTP server. */
async function main() {
  await loadSecrets();
  if (process.argv.length > 2) throw new Error("Este comando solo sincroniza permisos y roles; no recibe argumentos");
  const db = new Sequelize(require("../database/config.cjs")[process.env.NODE_ENV || "development"]);
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
