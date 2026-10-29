const { spawnSync } = require("node:child_process");
const result = spawnSync(process.execPath, [require.resolve("./createSuperUser.cjs")], {
  stdio: "inherit",
  windowsHide: true
});
process.exitCode = result.status ?? 1;
