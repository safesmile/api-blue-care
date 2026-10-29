const { spawnSync } = require("child_process");
const { randomBytes } = require("crypto");
const name = "blue-dent-test-" + Date.now();
const password = randomBytes(24).toString("hex");
function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Command failed");
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}
async function main() {
  try {
    run("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      name,
      "-e",
      "POSTGRES_DB=blue_dent_test",
      "-e",
      "POSTGRES_USER=test",
      "-e",
      "POSTGRES_PASSWORD=" + password,
      "-p",
      "127.0.0.1::5432",
      "postgres:17-alpine"
    ]);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      const r = spawnSync("docker", ["exec", name, "pg_isready", "-U", "test", "-d", "blue_dent_test"]);
      if (r.status === 0) {
        ready = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error("Test PostgreSQL failed to start");
    const port = run("docker", ["port", name, "5432/tcp"]).split(":").pop();
    const env = {
      ...process.env,
      NODE_ENV: "test",
      BLUE_DENT_TEST_DATABASE: "disposable",
      DB_HOST: "127.0.0.1",
      DB_PORT: port,
      DB_NAME: "blue_dent_test",
      DB_USER: "test",
      DB_PASSWORD: password,
      DB_SSL: "false",
      JWT_SECRET: randomBytes(48).toString("hex"),
      GCP_CONFIG_SECRET: ""
    };
    console.info(run(process.execPath, ["node_modules/sequelize-cli/lib/sequelize", "db:migrate"], { env }));
    console.info(
      run(process.execPath, ["node_modules/jest/bin/jest.js", "--config", "./src/test/jest-e2e.json", "--runInBand"], {
        env
      })
    );
    console.info("Integration tests passed with disposable PostgreSQL");
  } finally {
    spawnSync("docker", ["rm", "--force", name], { stdio: "ignore" });
  }
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
