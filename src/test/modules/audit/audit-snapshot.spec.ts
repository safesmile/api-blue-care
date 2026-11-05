import { auditSnapshot, sanitizeSnapshot } from "../../../modules/audit/domain/audit-snapshot";
import { identityChange } from "../../../modules/identity/domain/identity.events";
import { roleChange } from "../../../modules/authorization/domain/authorization.events";
import { invitationChange } from "../../../modules/auth/domain/invitation.events";
describe("Safe lifecycle event definitions", () => {
  it("selects module fields and removes secret-shaped keys recursively", () => {
    const raw = {
      email: "a@blue.test",
      passwordHash: "secret",
      tokenHash: "secret",
      nested: { accessToken: "secret", enabled: true },
      items: [{ smtpPassword: "secret", status: "ok" }],
      none: undefined
    };
    expect(auditSnapshot(raw, ["email", "passwordHash", "nested", "items", "none"])).toEqual({
      email: "a@blue.test",
      nested: { enabled: true },
      items: [{ status: "ok" }]
    });
    expect(auditSnapshot(null, ["id"])).toBeNull();
    expect(sanitizeSnapshot({ date: new Date("2026-11-03T00:00:00Z"), bad: Infinity, callback: () => true })).toEqual({
      date: "2026-11-03T00:00:00.000Z",
      bad: null,
      callback: null
    });
    expect(sanitizeSnapshot({ nested: { deep: true } }, 7)).toBeNull();
  });
  it("keeps account security notices free of credentials and makes deletion silent", () => {
    const event = identityChange(
      "user.password-changed",
      "user",
      "actor",
      { passwordHash: "secret", roles: ["b", "a"] },
      { passwordHash: "new-secret", roles: ["a", "b"] }
    );
    expect(event.before).toEqual({ roles: ["a", "b"] });
    expect(event.notifications?.[0].email).toBe(true);
    expect(JSON.stringify(event)).not.toContain("secret");
    expect(identityChange("user.deleted", "user", "actor", { email: "a@blue.test" }, null).notifications).toEqual([]);
  });
  it("notifies role members only when effective grants change", () => {
    const before = { permissions: ["auth:me"], description: "Old" };
    expect(
      roleChange("role.updated", "role", "actor", before, { ...before, description: "New" }, ["member"]).notifications
    ).toEqual([]);
    expect(
      roleChange("role.updated", "role", "actor", before, { permissions: ["users:read"] }, ["member"]).notifications
    ).toHaveLength(1);
    expect(
      invitationChange("invitation.created", "id", "actor", null, {
        email: "a@blue.test",
        tokenHash: "secret",
        token: "raw"
      }).after
    ).toEqual({ email: "a@blue.test" });
  });
});
