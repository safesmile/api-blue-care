import { AUTH_PERMISSIONS } from "./modules/auth/domain/auth.permissions";
import type { Permission } from "./shared/domain/permission";
export const ROLE_NAMES = ["superadmin", "admin", "customer"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];
// This file defines role policies only. Each module owns its permission definitions.
export const DEFAULT_ROLE_PERMISSIONS: Record<
  RoleName,
  { description: string; permissions: "*" | readonly Permission[] }
> = {
  superadmin: { description: "Full access to every registered module permission", permissions: "*" },
  admin: {
    description: "Administrator; business permissions pending definition",
    permissions: [
      AUTH_PERMISSIONS.me.shortcode,
      AUTH_PERMISSIONS.changePassword.shortcode,
      AUTH_PERMISSIONS.changeEmail.shortcode
    ]
  },
  customer: {
    description: "Customer; business permissions pending definition",
    permissions: [
      AUTH_PERMISSIONS.me.shortcode,
      AUTH_PERMISSIONS.changePassword.shortcode,
      AUTH_PERMISSIONS.changeEmail.shortcode
    ]
  }
};
