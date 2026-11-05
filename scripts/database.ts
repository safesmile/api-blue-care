import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { Sequelize } from "sequelize";
import { databaseOptions } from "../database/connection";
import { normalizeMigrationNames } from "../database/metadata";
import { loadSecrets } from "../src/infrastructure/config/load-secrets";
/** Runs the maintained Sequelize CLI with typed configuration and legacy history compatibility. */
async function main() {
  const [command, ...args] = process.argv.slice(2);
  const commands = [
    "db:migrate",
    "db:migrate:status",
    "db:migrate:undo",
    "db:migrate:undo:all",
    "db:seed",
    "db:seed:all",
    "db:seed:undo",
    "db:seed:undo:all"
  ];
  if (!commands.includes(command)) throw new Error("Unsupported database command");
  // Paths and environment are fixed so normalization and the CLI always target the same database.
  if (
    args.some(arg =>
      ["--config", "--env", "--url", "--options-path", "--migrations-path", "--seeders-path"].some(
        flag => arg === flag || arg.startsWith(flag + "=")
      )
    )
  )
    throw new Error("Configure database paths and connection through the project environment");
  await loadSecrets();
  const db = new Sequelize(databaseOptions());
  try {
    await normalizeMigrationNames(db);
  } finally {
    await db.close();
  }
  // sequelize-cli dynamically imports config, which cannot load TS via the CommonJS ts-node hook.
  // This generated JS bridge contains only an absolute module path, never database credentials.
  const directory = mkdtempSync(join(tmpdir(), "blue-dent-cli-"));
  const bridge = join(directory, "config.js");
  writeFileSync(
    bridge,
    "module.exports = require(" + JSON.stringify(resolve(__dirname, "../database/config.ts")) + ");\n"
  );
  try {
    const result = spawnSync(
      process.execPath,
      [
        "-r",
        "ts-node/register",
        require.resolve("sequelize-cli/lib/sequelize"),
        command,
        "--config",
        bridge,
        "--migrations-path",
        resolve(__dirname, "../database/migrations"),
        "--seeders-path",
        resolve(__dirname, "../database/seeders"),
        ...args.map(arg => arg.replace(/\.cjs$/, ".ts"))
      ],
      { stdio: "inherit", windowsHide: true }
    );
    process.exitCode = result.status ?? 1;
  } finally {
    unlinkSync(bridge);
    rmdirSync(directory);
  }
}
main().catch(() => {
  console.error("Database command failed. Check configuration, migration history and database availability.");
  process.exitCode = 1;
});
