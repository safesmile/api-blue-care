/**
 * Defines the resource contract.
 */
export abstract class PasswordHasher {
  /**
   * Hashes a password with a fresh salt.
   * @param password Plaintext password supplied by the caller.
   */
  abstract hash(password: string): Promise<string>;
  /**
   * Compares a plaintext password with its stored hash.
   * @param password Plaintext password supplied by the caller.
   * @param hash Stored token or password digest.
   */
  abstract compare(password: string, hash: string): Promise<boolean>;
}
