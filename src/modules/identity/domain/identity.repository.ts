import type { Page, Pagination } from "../../../shared/domain/crud.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import type { User, CollaboratorView } from "./user";
import { CrudRepository } from "../../../shared/domain/crud.repository";
/**
 * Defines the persistence operations required by the domain.
 */
export abstract class IdentityRepository extends CrudRepository<User> {
  abstract collaborators(page: Pagination, actor: AccessActor, id?: string): Promise<Page<CollaboratorView>>;
  abstract create(user: User, actor?: AccessActor): Promise<User>;
  abstract update(user: User, actor?: AccessActor, assignRoles?: boolean): Promise<User>;
  abstract delete(id: string, actor?: AccessActor): Promise<void>;
  /**
   * Finds a user by normalized email.
   * @param email Account email address.
   */
  abstract findByEmail(email: string): Promise<User | null>;
}
