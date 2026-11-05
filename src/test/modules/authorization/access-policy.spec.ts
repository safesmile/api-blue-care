import { AccessPolicy } from "../../../modules/authorization/domain/access-policy";
import { personName } from "../../../shared/domain/person-name";
describe("Explicit resource and delegation policies", () => {
  const actor = { id: "owner", roles: ["custom"], permissions: ["users:read"] as ["users:read"] };
  it("keeps identity ownership independent of custom role names", () => {
    expect(AccessPolicy.identity(actor, "users:read", "owner")).toBe(true);
    expect(AccessPolicy.identity(actor, "users:read", "other")).toBe(false);
    expect(
      AccessPolicy.identity({ ...actor, permissions: ["users:read", "users:manage"] }, "users:read", "other")
    ).toBe(true);
    expect(AccessPolicy.identity(undefined, "users:read")).toBe(false);
  });
  it("protects superadmin and prevents grant amplification", () => {
    expect(AccessPolicy.protectedAccount(actor, ["superadmin"])).toBe(false);
    expect(AccessPolicy.protectedAccount({ ...actor, roles: ["superadmin"] }, ["superadmin"])).toBe(true);
    expect(AccessPolicy.delegates(actor, ["roles:assign"])).toBe(false);
    expect(AccessPolicy.delegates(actor, ["users:read"])).toBe(true);
  });
  it("does not truncate names or guess missing historical parts", () => {
    expect(personName("a".repeat(61), "Last")).toBeNull();
    expect(personName("First", "")).toBeNull();
    expect(personName("First", "b".repeat(61))).toBeNull();
  });
});
