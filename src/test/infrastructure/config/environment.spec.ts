import { validateEnvironment } from "../../../infrastructure/config/environment";
const valid = {
  DB_HOST: "localhost",
  DB_NAME: "test",
  DB_USER: "test",
  DB_PASSWORD: "test",
  JWT_SECRET: "x".repeat(32)
};
describe("environment", () => {
  it("rejects missing secrets", () => expect(() => validateEnvironment({})).toThrow());
  it("rejects malformed expiration", () =>
    expect(() => validateEnvironment({ ...valid, ACCESS_TOKEN_SECONDS: "15m" })).toThrow());
  it("rejects wildcard CORS", () => expect(() => validateEnvironment({ ...valid, CORS_ORIGINS: "*" })).toThrow());
  it("defaults to bounded token lifetimes", () => expect(validateEnvironment(valid).ACCESS_TOKEN_SECONDS).toBe("900"));
  it("keeps billing disabled and requires correctly scoped credentials when enabled", () => {
    expect(validateEnvironment(valid).RECURRENTE_ENABLED).toBe("false");
    const billing = {
      ...valid,
      RECURRENTE_ENABLED: "true",
      RECURRENTE_MODE: "test",
      RECURRENTE_SECRET_KEY: "sk_test_" + "a".repeat(32),
      RECURRENTE_WEBHOOK_SECRET: "whsec_" + Buffer.from("test-only-signing-secret-32-bytes").toString("base64"),
      FRONTEND_URL: "http://localhost:5173"
    };
    expect(validateEnvironment(billing).RECURRENTE_MODE).toBe("test");
    for (const patch of [
      { RECURRENTE_ENABLED: "yes" },
      { RECURRENTE_MODE: "other" },
      { RECURRENTE_SECRET_KEY: "" },
      { RECURRENTE_MODE: "live" },
      { RECURRENTE_WEBHOOK_SECRET: "not-a-signing-secret" },
      { FRONTEND_URL: "https://user:pass@example.com" }
    ])
      expect(() => validateEnvironment({ ...billing, ...patch })).toThrow();
  });
  it("starts without Google credentials and leaves jobs disabled", () => {
    const env = validateEnvironment(valid);
    expect(env.GCP_JOBS_ENABLED).toBe("false");
    expect(env.EMAIL_PROVIDER).toBe("smtp");
  });
  it.each([
    { EMAIL_PROVIDER: "unknown" },
    { EMAIL_PROVIDER: "sendgrid" },
    { GCP_JOBS_ENABLED: "yes" },
    { GCP_JOBS_ENABLED: "true" },
    { SMTP_PORT: "65536" },
    { SMTP_REQUIRE_TLS: "yes" },
    { NOTIFICATION_MAX_ATTEMPTS: "0" },
    { NOTIFICATION_MAX_ATTEMPTS: "21" }
  ])("rejects incomplete or invalid service configuration %j", patch => {
    expect(() => validateEnvironment({ ...valid, ...patch })).toThrow();
  });
  it("keeps push off until an explicit Firebase project is configured", () => {
    expect(validateEnvironment(valid).PUSH_ENABLED).toBe("false");
    expect(() => validateEnvironment({ ...valid, PUSH_ENABLED: "yes" })).toThrow();
    expect(() => validateEnvironment({ ...valid, PUSH_ENABLED: "true" })).toThrow();
    expect(() => validateEnvironment({ ...valid, PUSH_ENABLED: "true", FIREBASE_PROJECT_ID: "bad/project" })).toThrow();
    expect(
      validateEnvironment({ ...valid, PUSH_ENABLED: "true", FIREBASE_PROJECT_ID: "blue-care-test" }).FIREBASE_PROJECT_ID
    ).toBe("blue-care-test");
  });
  it("requires an HTTPS callback origin and a Google service identity", () => {
    const cloud = {
      ...valid,
      GCP_JOBS_ENABLED: "true",
      GOOGLE_CLOUD_PROJECT: "blue-test",
      GCP_LOCATION: "us-central1",
      GCP_TASKS_QUEUE: "notifications",
      GCP_CALLBACK_URL: "https://blue.example",
      GCP_JOBS_AUDIENCE: "https://blue.example",
      GCP_JOBS_SERVICE_ACCOUNT: "jobs@blue-test.iam.gserviceaccount.com"
    };
    expect(validateEnvironment(cloud).GCP_JOBS_ENABLED).toBe("true");
    expect(() => validateEnvironment({ ...cloud, GCP_CALLBACK_URL: "http://blue.example" })).toThrow();
    expect(() => validateEnvironment({ ...cloud, GCP_CALLBACK_URL: "https://blue.example/api/v1" })).toThrow();
    expect(() => validateEnvironment({ ...cloud, GCP_JOBS_SERVICE_ACCOUNT: "person@example.com" })).toThrow();
    expect(
      validateEnvironment({ ...valid, EMAIL_PROVIDER: "sendgrid", SENDGRID_API_KEY: "test-only-key" }).EMAIL_PROVIDER
    ).toBe("sendgrid");
  });
  it("validates configurable email branding without requiring external assets", () => {
    expect(validateEnvironment(valid).EMAIL_APP_NAME).toBe("Blue Care");
    expect(validateEnvironment(valid).EMAIL_PRIMARY_COLOR).toBe("#1469b8");
    for (const patch of [
      { EMAIL_APP_NAME: " " },
      { EMAIL_APP_NAME: "bad\r\nname" },
      { EMAIL_APP_NAME: "x".repeat(81) },
      { EMAIL_PRIMARY_COLOR: "red" },
      { EMAIL_LOGO_URL: "not-a-url" },
      { EMAIL_LOGO_URL: "javascript:alert(1)" },
      { EMAIL_LOGO_URL: "https://user:pass@example.com" },
      { EMAIL_SUPPORT_EMAIL: "bad" }
    ])
      expect(() => validateEnvironment({ ...valid, ...patch })).toThrow();
    expect(
      validateEnvironment({
        ...valid,
        EMAIL_LOGO_URL: "https://blue.example/logo.png",
        EMAIL_SUPPORT_EMAIL: "help@blue.example"
      }).EMAIL_SUPPORT_EMAIL
    ).toBe("help@blue.example");
  });
});
