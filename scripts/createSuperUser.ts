import { databaseOptions } from "../database/connection";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { Sequelize } from "sequelize";
import { collectSuperUserInput, createSuperUser } from "./lib/super-user";
import { loadSecrets } from "../src/infrastructure/config/load-secrets";
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
  const question = (prompt: string) => new Promise<string>(resolve => terminal.question(prompt, resolve));
  const abort = () => {
    terminal.close();
    process.exitCode = 130;
  };
  terminal.once("SIGINT", abort);
  let values;
  try {
    values = await collectSuperUserInput({
      ask: prompt => question(prompt),
      password: async prompt => {
        process.stdout.write(prompt);
        muted = true;
        try {
          return await question("");
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
  const db = new Sequelize(databaseOptions());
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
