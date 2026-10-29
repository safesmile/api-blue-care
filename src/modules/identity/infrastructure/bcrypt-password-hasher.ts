import { BadRequestException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PasswordHasher } from "../domain/password-hasher";
/**
 * Hashes and compares passwords within the bcrypt byte limit.
 */
@Injectable()
export class BcryptPasswordHasher extends PasswordHasher {
  /**
   * Hashes a password with a fresh salt.
   * @param password Plaintext password supplied by the caller.
   * @returns Result of the completed operation.
   */
  hash(password: string) {
    if (Buffer.byteLength(password, "utf8") > 72) throw new BadRequestException("Password exceeds 72 bytes");
    return bcrypt.hash(password, 12);
  }
  /**
   * Compares a plaintext password with its stored hash.
   * @param password Plaintext password supplied by the caller.
   * @param hash Stored token or password digest.
   * @returns Whether the required checks passed.
   */
  compare(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }
}
