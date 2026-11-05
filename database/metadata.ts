import { readdirSync } from "node:fs";
import { join } from "node:path";
import { QueryTypes, type Sequelize } from "sequelize";
/**
 * Renames only tracked legacy file identifiers; never replays migrations or modifies application records.
 * @param db Database connection supplied by the caller.
 */
export async function normalizeMigrationNames(db: Sequelize): Promise<void> {
  await db.transaction(async transaction => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('blue-dent-migration-names'))", { transaction });
    for (const [table, directory] of [
      ["SequelizeMeta", "migrations"],
      ["SequelizeData", "seeders"]
    ] as const) {
      if (!(await db.getQueryInterface().tableExists(table, { transaction }))) continue;
      const tracked = await db.query<{ name: string }>(`SELECT name FROM "${table}"`, {
        type: QueryTypes.SELECT,
        transaction
      });
      const names = new Set(tracked.map(row => row.name));
      for (const file of readdirSync(join(__dirname, directory)).filter(
        name => name.endsWith(".ts") && !name.endsWith(".d.ts")
      )) {
        const legacy = file.slice(0, -3) + ".cjs";
        if (!names.has(legacy)) continue;
        if (names.has(file)) throw new Error("Conflicting migration history for " + file);
        await db.query(`UPDATE "${table}" SET name = :file WHERE name = :legacy`, {
          replacements: { file, legacy },
          transaction
        });
      }
    }
  });
}
