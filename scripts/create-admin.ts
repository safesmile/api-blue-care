import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, ["-r", "ts-node/register", require.resolve("./createSuperUser")], {
  stdio: "inherit",
  windowsHide: true
});
process.exitCode = result.status ?? 1;
