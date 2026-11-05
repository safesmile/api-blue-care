import "dotenv/config";
import type { Options } from "sequelize";
/**
 * Reads current settings after optional Secret Manager configuration has loaded.
 * @returns PostgreSQL connection settings.
 */
export function databaseOptions(): Options {
  return {
    dialect: "postgres",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    logging: false,
    dialectOptions: process.env.DB_SSL === "true" ? { ssl: { require: true, rejectUnauthorized: true } } : {}
  };
}
