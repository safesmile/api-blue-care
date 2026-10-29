const { randomUUID } = require("node:crypto");
const { hash } = require("bcryptjs");
const { isEmail } = require("class-validator");
const { QueryTypes, UniqueConstraintError } = require("sequelize");
const { syncPermissions } = require("../../src/modules/authorization/infrastructure/sync-permissions");
/** Checks the same password requirements used by the API. */
function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    Buffer.byteLength(password, "utf8") <= 72 &&
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])\S+$/.test(password)
  );
}
/** Validates console inputs before database access. */
function validateSuperUserInput(input) {
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
/** Collects and confirms credentials through an injectable console interface. */
async function collectSuperUserInput(io) {
  let firstName, lastName, email, password;
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
/** Synchronizes role definitions and creates a verified superadmin without replacing existing accounts. */
async function createSuperUser(db, input) {
  const values = validateSuperUserInput(input);
  await syncPermissions(db);
  const passwordHash = await hash(values.password, 12);
  const id = randomUUID();
  try {
    await db.transaction(async transaction => {
      const [role] = await db.query("SELECT id FROM roles WHERE name = :name", {
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
module.exports = { collectSuperUserInput, createSuperUser, validateSuperUserInput };
