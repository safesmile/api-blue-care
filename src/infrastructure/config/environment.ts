/**
 * Validates required settings and applies configuration defaults.
 * @param env Environment values before validation.
 * @returns Result of the completed operation.
 */
export function validateEnvironment(env: Record<string, unknown>) {
  const value: Record<string, unknown> = {
    EMAIL_APP_NAME: "Blue Care",
    EMAIL_PRIMARY_COLOR: "#1469b8",
    PUSH_ENABLED: "false",
    EMAIL_PROVIDER: "smtp",
    RECURRENTE_ENABLED: "false",
    RECURRENTE_MODE: "test",
    GCP_JOBS_ENABLED: "false",
    NOTIFICATION_MAX_ATTEMPTS: "5",
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
  if (
    typeof value.EMAIL_APP_NAME !== "string" ||
    !value.EMAIL_APP_NAME.trim() ||
    value.EMAIL_APP_NAME.length > 80 ||
    /[\r\n]/.test(value.EMAIL_APP_NAME)
  )
    throw new Error("Invalid EMAIL_APP_NAME");
  if (!/^#[a-f0-9]{6}$/i.test(String(value.EMAIL_PRIMARY_COLOR))) throw new Error("Invalid EMAIL_PRIMARY_COLOR");
  if (value.EMAIL_SUPPORT_EMAIL && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(String(value.EMAIL_SUPPORT_EMAIL)))
    throw new Error("Invalid EMAIL_SUPPORT_EMAIL");
  if (value.EMAIL_LOGO_URL) {
    let logo: URL;
    try {
      logo = new URL(String(value.EMAIL_LOGO_URL));
    } catch {
      throw new Error("Invalid EMAIL_LOGO_URL");
    }
    if (!["http:", "https:"].includes(logo.protocol) || logo.username || logo.password)
      throw new Error("Invalid EMAIL_LOGO_URL");
  }
  if (!["true", "false"].includes(String(value.PUSH_ENABLED))) throw new Error("Invalid PUSH_ENABLED");
  if (value.PUSH_ENABLED === "true" && !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(String(value.FIREBASE_PROJECT_ID ?? "")))
    throw new Error("Invalid FIREBASE_PROJECT_ID");
  if (!["smtp", "sendgrid"].includes(String(value.EMAIL_PROVIDER))) throw new Error("Invalid EMAIL_PROVIDER");
  if (value.EMAIL_PROVIDER === "sendgrid" && !value.SENDGRID_API_KEY) throw new Error("Missing SENDGRID_API_KEY");
  if (!["true", "false"].includes(String(value.GCP_JOBS_ENABLED))) throw new Error("Invalid GCP_JOBS_ENABLED");
  if (
    !/^\d+$/.test(String(value.NOTIFICATION_MAX_ATTEMPTS)) ||
    Number(value.NOTIFICATION_MAX_ATTEMPTS) < 1 ||
    Number(value.NOTIFICATION_MAX_ATTEMPTS) > 20
  )
    throw new Error("Invalid NOTIFICATION_MAX_ATTEMPTS");
  if (
    value.SMTP_PORT !== undefined &&
    (!/^\d+$/.test(String(value.SMTP_PORT)) || Number(value.SMTP_PORT) < 1 || Number(value.SMTP_PORT) > 65535)
  )
    throw new Error("Invalid SMTP_PORT");
  if (value.SMTP_REQUIRE_TLS && !["true", "false"].includes(String(value.SMTP_REQUIRE_TLS)))
    throw new Error("Invalid SMTP_REQUIRE_TLS");
  if (value.GCP_JOBS_ENABLED === "true") {
    for (const key of [
      "GOOGLE_CLOUD_PROJECT",
      "GCP_LOCATION",
      "GCP_TASKS_QUEUE",
      "GCP_CALLBACK_URL",
      "GCP_JOBS_SERVICE_ACCOUNT",
      "GCP_JOBS_AUDIENCE"
    ])
      if (typeof value[key] !== "string" || !value[key]) throw new Error("Missing environment variable: " + key);
    const callback = new URL(String(value.GCP_CALLBACK_URL));
    if (
      callback.protocol !== "https:" ||
      callback.username ||
      callback.password ||
      callback.pathname !== "/" ||
      callback.search ||
      callback.hash
    )
      throw new Error("GCP_CALLBACK_URL must be an HTTPS origin");
    if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(String(value.GCP_JOBS_SERVICE_ACCOUNT)))
      throw new Error("Invalid GCP_JOBS_SERVICE_ACCOUNT");
  }
  if (!["true", "false"].includes(String(value.RECURRENTE_ENABLED))) throw new Error("Invalid RECURRENTE_ENABLED");
  if (!["test", "live"].includes(String(value.RECURRENTE_MODE))) throw new Error("Invalid RECURRENTE_MODE");
  if (value.RECURRENTE_ENABLED === "true") {
    const prefix = value.RECURRENTE_MODE === "live" ? "sk_live_" : "sk_test_";
    if (
      typeof value.RECURRENTE_SECRET_KEY !== "string" ||
      !value.RECURRENTE_SECRET_KEY.startsWith(prefix) ||
      value.RECURRENTE_SECRET_KEY.length < 20
    )
      throw new Error("RECURRENTE_SECRET_KEY must match the selected mode");
    if (
      typeof value.RECURRENTE_WEBHOOK_SECRET !== "string" ||
      !/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(value.RECURRENTE_WEBHOOK_SECRET) ||
      Buffer.from(value.RECURRENTE_WEBHOOK_SECRET.slice(6), "base64").length < 16
    )
      throw new Error("Invalid RECURRENTE_WEBHOOK_SECRET");
    const frontend = new URL(String(value.FRONTEND_URL));
    if (
      !["http:", "https:"].includes(frontend.protocol) ||
      frontend.username ||
      frontend.password ||
      frontend.search ||
      frontend.hash ||
      (value.RECURRENTE_MODE === "live" && frontend.protocol !== "https:")
    )
      throw new Error("Invalid FRONTEND_URL for Recurrente");
  }
  return value;
}
