/**
 * Validates required settings and applies configuration defaults.
 * @param env Environment values before validation.
 * @returns Result of the completed operation.
 */
export function validateEnvironment(env: Record<string, unknown>) {
  const value: Record<string, unknown> = {
    NODE_ENV: "development",
    PORT: "3000",
    DB_PORT: "5432",
    DB_SSL: "false",
    ACCESS_TOKEN_SECONDS: "900",
    REFRESH_TOKEN_SECONDS: "604800",
    SESSION_MAX_SECONDS: "2592000",
    CORS_ORIGINS: "http://localhost:5173",
    ...env
  };
  for (const key of ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET"]) {
    if (typeof value[key] !== "string" || !value[key]) throw new Error("Missing environment variable: " + key);
  }
  if (String(value.JWT_SECRET).length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
  for (const key of ["PORT", "DB_PORT", "ACCESS_TOKEN_SECONDS", "REFRESH_TOKEN_SECONDS", "SESSION_MAX_SECONDS"]) {
    if (!/^\d+$/.test(String(value[key])) || Number(value[key]) < 1 || !Number.isSafeInteger(Number(value[key])))
      throw new Error("Invalid positive integer: " + key);
  }
  if (!["development", "test", "production"].includes(String(value.NODE_ENV))) throw new Error("Invalid NODE_ENV");
  if (!["true", "false"].includes(String(value.DB_SSL))) throw new Error("Invalid DB_SSL");
  if (
    String(value.CORS_ORIGINS)
      .split(",")
      .some(x => x.trim() === "*")
  )
    throw new Error("Use explicit CORS origins");
  return value;
}
