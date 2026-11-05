import { recordChange } from "../../src/modules/audit/infrastructure/record-change";
import { identityChange } from "../../src/modules/identity/domain/identity.events";
import type { Sequelize } from "sequelize";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { isEmail } from "class-validator";
import { QueryTypes, UniqueConstraintError } from "sequelize";
import { syncPermissions } from "../../src/modules/authorization/infrastructure/sync-permissions";
export interface SuperUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}
export interface ConsoleInput {
  ask(prompt: string): Promise<string>;
  password(prompt: string): Promise<string>;
  info(message: string): void;
}
/**
 * Checks the same password requirements used by the API.
 * @returns Validated result of the operation.
 * @param password Plaintext candidate validated without logging.
 */
function validPassword(password: string) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    Buffer.byteLength(password, "utf8") <= 72 &&
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])\S+$/.test(password)
  );
}
/**
 * Validates console inputs before database access.
 * @returns Validated result of the operation.
 * @param input Name, contact and credential supplied by the operator.
 */
function validateSuperUserInput(input: SuperUserInput) {
  const firstName = String(input.firstName || "").trim();
  const lastName = String(input.lastName || "").trim();
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (
    !firstName ||
    firstName.length > 60 ||
    !lastName ||
    lastName.length > 60 ||
    (firstName + " " + lastName).length > 120
  )
    throw new Error("Nombre y apellido son obligatorios y deben sumar como máximo 119 caracteres");
  if (!isEmail(email) || email.length > 254) throw new Error("Email inválido");
  if (!validPassword(input.password))
    throw new Error(
      "La contraseña requiere al menos 8 caracteres, mayúscula, minúscula, número y símbolo; máximo 72 bytes y sin espacios"
    );
  return { firstName, lastName, email, password: input.password };
}
/**
 * Collects and confirms credentials through an injectable console interface.
 * @returns Validated result of the operation.
 * @param io Injectable console prompts and feedback.
 */
async function collectSuperUserInput(io: ConsoleInput) {
  let firstName = "",
    lastName = "",
    email = "",
    password = "";
  while (!firstName || firstName.length > 60) firstName = (await io.ask("Nombre: ")).trim();
  while (!lastName || lastName.length > 60 || (firstName + " " + lastName).length > 120)
    lastName = (await io.ask("Apellido: ")).trim();
  while (!email || !isEmail(email) || email.length > 254) email = (await io.ask("Email: ")).trim().toLowerCase();
  while (true) {
    password = await io.password("Contraseña (8+ caracteres, mayúscula, minúscula, número y símbolo): ");
    if (!validPassword(password)) {
      io.info("La contraseña no cumple los requisitos. Inténtalo de nuevo.");
      continue;
    }
    const confirmation = await io.password("Confirmar contraseña: ");
    if (password === confirmation) break;
    io.info("Las contraseñas no coinciden. Inténtalo de nuevo.");
  }
  return validateSuperUserInput({ firstName, lastName, email, password });
}
/**
 * Synchronizes role definitions and creates a verified superadmin without replacing existing accounts.
 * @returns Validated result of the operation.
 * @param db Database connection supplied by the caller.
 * @param input Name, contact and credential supplied by the operator.
 */
async function createSuperUser(db: Sequelize, input: SuperUserInput) {
  const values = validateSuperUserInput(input);
  await syncPermissions(db);
  const passwordHash = await hash(values.password, 12);
  const id = randomUUID();
  try {
    await db.transaction(async transaction => {
      const [role] = await db.query<{ id: string }>("SELECT id FROM roles WHERE name = :name", {
        replacements: { name: "superadmin" },
        type: QueryTypes.SELECT,
        transaction
      });
      if (!role) throw new Error("No se pudo sincronizar el rol superadmin");
      await db.query(
        `INSERT INTO users (id,email,name,"firstName","lastName","passwordHash",enabled,verified,"createdAt","updatedAt")
         VALUES (:id,:email,:name,:firstName,:lastName,:passwordHash,true,true,NOW(),NOW())`,
        {
          replacements: {
            id,
            email: values.email,
            name: values.firstName + " " + values.lastName,
            firstName: values.firstName,
            lastName: values.lastName,
            passwordHash
          },
          transaction
        }
      );
      await db.query('INSERT INTO "user_roles" ("userId","roleId") VALUES (:id,:roleId)', {
        replacements: { id, roleId: role.id },
        transaction
      });
      if (await db.getQueryInterface().tableExists("audit_events", { transaction }))
        await recordChange(
          db,
          transaction,
          identityChange("user.created", id, undefined, null, {
            id,
            email: values.email,
            firstName: values.firstName,
            lastName: values.lastName,
            name: values.firstName + " " + values.lastName,
            enabled: true,
            verified: true,
            roles: ["superadmin"]
          })
        );
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw new Error("Ya existe una cuenta con ese email; no se modificó");
    throw error;
  }
  return {
    id,
    email: values.email,
    firstName: values.firstName,
    lastName: values.lastName,
    verified: true,
    roles: ["superadmin"]
  };
}
export { collectSuperUserInput, createSuperUser, validateSuperUserInput };
