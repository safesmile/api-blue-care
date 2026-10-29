import type { User } from "./user";
import { CrudRepository } from "../../../shared/domain/crud.repository";
/**
 * Defines the persistence operations required by the domain.
 */
export abstract class IdentityRepository extends CrudRepository<User> {
  /**
   * Finds a user by normalized email.
   * @param email Account email address.
   */
  abstract findByEmail(email: string): Promise<User | null>;
}
