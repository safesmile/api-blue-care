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
});
