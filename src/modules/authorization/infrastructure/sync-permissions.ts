import { preserveLegacyGrants } from "./preserve-legacy-grants";
import { randomUUID } from "node:crypto";
import { QueryTypes, type Sequelize } from "sequelize";
import { DEFAULT_ROLE_PERMISSIONS } from "../../../permissions";
import { REGISTERED_PERMISSIONS } from "./permission-registry";
/**
 * Reconciles the managed permission catalog and default roles in one transaction.
 * @param db Database connection.
 */
export async function syncPermissions(db: Sequelize): Promise<void> {
  await db.transaction(async transaction => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('blue-dent-permissions'))", { transaction });
    for (const permission of REGISTERED_PERMISSIONS) {
      await db.query(
        `INSERT INTO permissions (shortcode, scope, description, "group") VALUES (:shortcode, :scope, :description, :group)
         ON CONFLICT (shortcode) DO UPDATE SET scope = EXCLUDED.scope,
         description = EXCLUDED.description, "group" = EXCLUDED."group"`,
        { replacements: { ...permission }, transaction }
      );
    }
    await db.query("DELETE FROM permissions WHERE shortcode NOT IN (:codes)", {
      replacements: { codes: REGISTERED_PERMISSIONS.map(permission => permission.shortcode) },
      transaction
    });
    for (const [name, definition] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const [role] = await db.query<{ id: string }>(
        `INSERT INTO roles (id, name, description, "isProtected") VALUES (:id, :name, :description, true)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, "isProtected" = true RETURNING id`,
        {
          replacements: { id: randomUUID(), name, description: definition.description },
          type: QueryTypes.SELECT,
          transaction
        }
      );
      await db.query('DELETE FROM "role_permissions" WHERE "roleId" = :roleId', {
        replacements: { roleId: role.id },
        transaction
      });
      for (const code of definition.permissions === "*"
        ? REGISTERED_PERMISSIONS.map(permission => permission.shortcode)
        : definition.permissions)
        await db.query('INSERT INTO "role_permissions" ("roleId", "permissionCode") VALUES (:roleId, :code)', {
          replacements: { roleId: role.id, code },
          transaction
        });
    }
    await preserveLegacyGrants(db, transaction);
  });
}
