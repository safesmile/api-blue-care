require("ts-node").register({ transpileOnly: true });
const { createInterface } = require("node:readline/promises");
const { Writable } = require("node:stream");
const { Sequelize } = require("sequelize");
const { collectSuperUserInput, createSuperUser } = require("./lib/super-user.cjs");
const { loadSecrets } = require("../src/infrastructure/config/load-secrets");
/** Runs the interactive operational account provisioning flow. */
async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error(
      "Ejecuta este comando desde una terminal interactiva; no acepta contraseñas por argumentos ni archivos"
    );
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    }
  });
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  const abort = () => {
    terminal.close();
    process.exitCode = 130;
  };
  terminal.once("SIGINT", abort);
  let values;
  try {
    values = await collectSuperUserInput({
      ask: prompt => terminal.question(prompt),
      password: async prompt => {
        process.stdout.write(prompt);
        muted = true;
        try {
          return await terminal.question("");
        } finally {
          muted = false;
          process.stdout.write("\n");
        }
      },
      info: message => console.info(message)
    });
  } finally {
    terminal.close();
    output.end();
  }
  await loadSecrets();
  const db = new Sequelize(require("../database/config.cjs")[process.env.NODE_ENV || "development"]);
  try {
    const user = await createSuperUser(db, values);
    console.info("Superusuario verificado creado con rol superadmin:", user.email);
  } finally {
    await db.close();
  }
}
if (require.main === module)
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
