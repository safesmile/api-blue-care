import type { IDENTITY_PERMISSION_DEFINITIONS } from "../../modules/identity/domain/identity.permissions";
import type { AUTH_PERMISSION_DEFINITIONS } from "../../modules/auth/domain/auth.permissions";
export type Permission =
  | (typeof IDENTITY_PERMISSION_DEFINITIONS)[number]["shortcode"]
  | (typeof AUTH_PERMISSION_DEFINITIONS)[number]["shortcode"];
export interface PermissionDefinition {
  shortcode: Permission;
  scope: string;
  group: string;
  description: string;
}
