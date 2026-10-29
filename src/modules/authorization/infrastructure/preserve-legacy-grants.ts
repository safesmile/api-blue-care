import { randomUUID } from "node:crypto";
import { QueryTypes, type Sequelize, type Transaction } from "sequelize";
import { REGISTERED_PERMISSIONS } from "./permission-registry";
/**
 * Converts historical direct grants once, during explicit permission synchronization.
 * @param db Database connection.
 * @param transaction Synchronization transaction.
 */
export async function preserveLegacyGrants(db: Sequelize, transaction: Transaction): Promise<void> {
  const catalog = new Set<string>(REGISTERED_PERMISSIONS.map(permission => permission.shortcode));
  /**
   * Maps old broad grants to the module operation codes.
   * @param values Historical permission codes.
   * @returns Current permission codes without automatic superadmin promotion.
   */
  function expand(values: string[]) {
    const codes = new Set(["auth:me"]);
    for (const value of values) {
      if (value === "users:write")
        for (const code of ["users:create", "users:update", "users:delete", "roles:assign"]) codes.add(code);
      else if (value === "users:read") {
        codes.add(value);
        codes.add("users:list");
      } else if (catalog.has(value)) codes.add(value);
    }
    return [...codes];
  }
  /**
   * Upserts a compatibility role without replacing assigned default roles.
   * @param name Stable compatibility role name.
   * @param codes Historical grant list.
   * @returns Persisted role identifier.
   */
  async function role(name: string, codes: string[]) {
    const [row] = await db.query<{ id: string }>(
      'INSERT INTO roles (id,name,description,"isProtected") VALUES (:id,:name,:description,true) ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description RETURNING id',
      {
        replacements: { id: randomUUID(), name, description: "Preserved historical grants" },
        type: QueryTypes.SELECT,
        transaction
      }
    );
    for (const code of expand(codes))
      await db.query(
        'INSERT INTO "role_permissions" ("roleId","permissionCode") VALUES (:id,:code) ON CONFLICT DO NOTHING',
        { replacements: { id: row.id, code }, transaction }
      );
    return row.id;
  }
  const columns = await db.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = :column",
    { replacements: { column: "permissions" }, type: QueryTypes.SELECT, transaction }
  );
  const users = { permissions: columns.some(column => column.table_name === "users") };
  if (users.permissions) {
    const rows = await db.query<{ id: string; permissions: string[] }>(
      "SELECT id, permissions FROM users WHERE cardinality(permissions) > 0 FOR UPDATE",
      { type: QueryTypes.SELECT, transaction }
    );
    for (const user of rows) {
      const roleId = await role("legacy-user-" + user.id, user.permissions);
      await db.query('INSERT INTO "user_roles" ("userId","roleId") VALUES (:userId,:roleId) ON CONFLICT DO NOTHING', {
        replacements: { userId: user.id, roleId },
        transaction
      });
      await db.query("UPDATE users SET permissions = '{}' WHERE id = :id", {
        replacements: { id: user.id },
        transaction
      });
    }
  }
  const actions = { permissions: columns.some(column => column.table_name === "account_actions") };
  if (actions.permissions) {
    const rows = await db.query<{ hash: string; permissions: string[]; roles: string[] }>(
      "SELECT hash, permissions, roles FROM \"account_actions\" WHERE kind = 'invite' AND cardinality(permissions) > 0 FOR UPDATE",
      { type: QueryTypes.SELECT, transaction }
    );
    for (const action of rows) {
      if (!action.roles.length) {
        const name = "legacy-invite-" + action.hash;
        await role(name, action.permissions);
        await db.query("UPDATE account_actions SET roles = ARRAY[:name]::varchar[] WHERE hash = :hash", {
          replacements: { name, hash: action.hash },
          transaction
        });
      }
      await db.query("UPDATE account_actions SET permissions = '{}' WHERE hash = :hash", {
        replacements: { hash: action.hash },
        transaction
      });
    }
  }
}
