import { Entity } from "../../../shared/domain/entity";
export type { Permission } from "../../../shared/domain/permission";
import type { Permission } from "../../../shared/domain/permission";
export interface UserProps {
  firstName: string;
  lastName: string;
  verified: boolean;
  email: string;
  name: string;
  passwordHash: string;
  enabled: boolean;
  /** Derived from user_roles and role_permissions; never a users table column. */
  permissions: Permission[];
  roles: string[];
}
/**
 * Represents a Blue Dent user independently of persistence.
 */
export class User extends Entity<UserProps> {
  /**
   * Builds a user view that excludes the password hash.
   * @returns Public user properties without credentials.
   */
  toView() {
    const { email, name, enabled, permissions, roles, firstName, lastName, verified } = this.props;
    return { id: this.id, email, name, enabled, permissions, roles, firstName, lastName, verified };
  }
}
export type UserView = ReturnType<User["toView"]>;
