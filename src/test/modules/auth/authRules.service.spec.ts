import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "node:crypto";
import { AuthRules } from "../../../modules/auth/application/authRules.service";

describe("Emisión compartida de sesiones", () => {
  const jwt = new JwtService({ secret: "test-only-session-signing-key" });
  const config = new ConfigService({ SESSION_MAX_SECONDS: 3600, REFRESH_TOKEN_SECONDS: 600, ACCESS_TOKEN_SECONDS: 60 });
  const issuer = new AuthRules(jwt, config);
  it("emite por defecto personal sin clínica y persiste solamente el hash del refresh", async () => {
    const start = Date.now();
    const result = await issuer.issue("staff-user");
    expect(jwt.verify(result.token)).toMatchObject({
      sub: "staff-user",
      sid: result.session.id,
      mode: "staff",
      clinicId: null,
      iss: "blue-dent",
      aud: "blue-dent-api"
    });
    expect(result.session.tokenHash).toBe(createHash("sha256").update(result.refreshToken).digest("hex"));
    expect(result.session.tokenHash).not.toBe(result.refreshToken);
    expect(result.session.absoluteExpiresAt.getTime()).toBeGreaterThanOrEqual(start + 3600000);
    expect(result.session.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 600000);
  });
  it("omite la clínica del token del paciente y respeta el vencimiento absoluto anterior", async () => {
    const deadline = new Date(Date.now() + 30000);
    const result = await issuer.issue("patient-user", deadline, null, "patient");
    const payload = jwt.verify(result.token);
    expect(payload.mode).toBe("patient");
    expect(payload).not.toHaveProperty("clinicId");
    expect(result.session.absoluteExpiresAt).toBe(deadline);
    expect(result.session.expiresAt).toEqual(deadline);
  });
});
