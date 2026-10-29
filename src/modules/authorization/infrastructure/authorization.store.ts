import { Injectable, BadRequestException } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, type Transaction } from "sequelize";
import type { Permission } from "../../../shared/domain/permission";
/**
 * Resolves current role grants from the relational authorization tables.
 */
@Injectable()
export class AuthorizationStore {
  /**
   * Receives the database connection.
   * @param db PostgreSQL connection.
   */
  constructor(private readonly db: Sequelize) {}
  /**
   * Reads role names assigned to a user.
   * @param userId User identifier.
   * @param transaction Optional transaction.
   * @returns Assigned role names.
   */
  async rolesFor(userId: string, transaction?: Transaction): Promise<string[]> {
    const rows = await this.db.query<{ name: string }>(
      'SELECT r.name FROM roles r JOIN "user_roles" ur ON ur."roleId" = r.id WHERE ur."userId" = :userId ORDER BY r.name',
      { replacements: { userId }, type: QueryTypes.SELECT, transaction }
    );
    return rows.map(row => row.name);
  }
  /**
   * Resolves the unique union of role grants.
   * @param roles Assigned role names.
   * @param transaction Optional transaction.
   * @returns Effective permission shortcodes.
   */
  async permissionsFor(roles: string[], transaction?: Transaction): Promise<Permission[]> {
    if (!roles.length) return [];
    const rows = await this.db.query<{ shortcode: Permission }>(
      'SELECT DISTINCT p.shortcode FROM permissions p JOIN "role_permissions" rp ON rp."permissionCode" = p.shortcode JOIN roles r ON r.id = rp."roleId" WHERE r.name IN (:roles) ORDER BY p.shortcode',
      { replacements: { roles }, type: QueryTypes.SELECT, transaction }
    );
    return rows.map(row => row.shortcode);
  }
  /**
   * Replaces a user membership atomically with its resource write.
   * @param userId User identifier.
   * @param names Desired role names.
   * @param transaction Resource transaction.
   */
  async setRoles(userId: string, names: string[], transaction: Transaction): Promise<void> {
    const unique = [...new Set(names)];
    const roles = unique.length
      ? await this.db.query<{ id: string }>("SELECT id FROM roles WHERE name IN (:names)", {
          replacements: { names: unique },
          type: QueryTypes.SELECT,
          transaction
        })
      : [];
    if (roles.length !== unique.length) throw new BadRequestException("Unknown role; run npm run permissions first");
    await this.db.query('DELETE FROM "user_roles" WHERE "userId" = :userId', { replacements: { userId }, transaction });
    for (const role of roles)
      await this.db.query('INSERT INTO "user_roles" ("userId", "roleId") VALUES (:userId, :roleId)', {
        replacements: { userId, roleId: role.id },
        transaction
      });
  }
}
