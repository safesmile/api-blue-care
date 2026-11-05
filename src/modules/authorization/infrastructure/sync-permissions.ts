import { recordChange } from "../../audit/infrastructure/record-change";
import { auditSnapshot } from "../../audit/domain/audit-snapshot";
import { preserveLegacyGrants } from "./preserve-legacy-grants";
import { randomUUID } from "node:crypto";
import { QueryTypes, type Sequelize } from "sequelize";
import { DEFAULT_ROLE_PERMISSIONS } from "../../../permissions";
import { REGISTERED_PERMISSIONS } from "./permission-registry";
const DEFAULT_ROLE_AUDIT_SQL = [
  "SELECT r.name,r.description,",
  'COALESCE(array_agg(rp."permissionCode" ORDER BY rp."permissionCode")',
  "FILTER (WHERE rp.\"permissionCode\" IS NOT NULL),'{}') AS permissions",
  'FROM roles r LEFT JOIN role_permissions rp ON rp."roleId"=r.id',
  "WHERE r.name IN (:names) GROUP BY r.id ORDER BY r.name"
].join(" ");
/**
 * Reconciles the managed permission catalog and default roles in one transaction.
 * @param db Database connection.
 */
export async function syncPermissions(db: Sequelize): Promise<void> {
  await db.transaction(async transaction => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('blue-dent-permissions'))", { transaction });
    const canAudit = await db.getQueryInterface().tableExists("audit_events", { transaction });
    const before = canAudit
      ? await db.query(DEFAULT_ROLE_AUDIT_SQL, {
          replacements: { names: Object.keys(DEFAULT_ROLE_PERMISSIONS) },
          transaction,
          type: QueryTypes.SELECT
        })
      : [];
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
    if (canAudit) {
      const after = await db.query(DEFAULT_ROLE_AUDIT_SQL, {
        replacements: { names: Object.keys(DEFAULT_ROLE_PERMISSIONS) },
        transaction,
        type: QueryTypes.SELECT
      });
      await recordChange(db, transaction, {
        action: "permissions.synchronized",
        resourceType: "configuration",
        resourceId: "default-roles",
        before: auditSnapshot({ roles: before }, ["roles"]),
        after: auditSnapshot({ roles: after }, ["roles"])
      });
    }
  });
}
