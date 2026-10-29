import { User } from "../../modules/identity/domain/user";
import type { IdentityRepository } from "../../modules/identity/domain/identity.repository";
import type { PasswordHasher } from "../../modules/identity/domain/password-hasher";
/**
 * Creates a domain user without persistence or real credentials.
 * @param enabled Whether the fixture user may authenticate.
 * @returns Result of the completed operation.
 */
export function userFixture(enabled = true) {
  return new User(
    {
      firstName: "Admin",
      lastName: "",
      verified: true,
      email: "admin@blue.test",
      name: "Admin",
      passwordHash: "stored-hash",
      enabled,
      permissions: ["users:read"],
      roles: ["customer"]
    },
    "a08dd395-c817-471d-a210-3a7096fdb844"
  );
}
/**
 * Creates independent identity dependency mocks.
 * @returns Result of the completed operation.
 */
export function identityFixture() {
  const users: jest.Mocked<IdentityRepository> = {
    create: jest.fn(async user => user),
    read: jest.fn(),
    list: jest.fn(),
    update: jest.fn(async user => user),
    delete: jest.fn(),
    findByEmail: jest.fn()
  };
  const passwords: jest.Mocked<PasswordHasher> = {
    hash: jest
      .fn<ReturnType<PasswordHasher["hash"]>, Parameters<PasswordHasher["hash"]>>()
      .mockResolvedValue("new-hash"),
    compare: jest
      .fn<ReturnType<PasswordHasher["compare"]>, Parameters<PasswordHasher["compare"]>>()
      .mockResolvedValue(true)
  };
  return { users, passwords };
}
