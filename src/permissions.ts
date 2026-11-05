import { AUTHORIZATION_PERMISSIONS } from "./modules/authorization/domain/authorization.permissions";
import { NOTIFICATION_PERMISSIONS } from "./modules/notifications/domain/notification.permissions";
import { AUTH_PERMISSIONS } from "./modules/auth/domain/auth.permissions";
import type { Permission } from "./shared/domain/permission";
export const DEFAULT_ROLE_NAMES = ["superadmin", "admin", "customer"] as const;
export type DefaultRoleName = (typeof DEFAULT_ROLE_NAMES)[number];
export type RoleName = string;
// This file defines role policies only. Each module owns its permission definitions.
export const DEFAULT_ROLE_PERMISSIONS: Record<
  DefaultRoleName,
  { description: string; permissions: "*" | readonly Permission[] }
> = {
  superadmin: { description: "Full access to every registered module permission", permissions: "*" },
  admin: {
    description: "Administrator; business permissions pending definition",
    permissions: [
      AUTH_PERMISSIONS.me.shortcode,
      AUTH_PERMISSIONS.changePassword.shortcode,
      AUTH_PERMISSIONS.changeEmail.shortcode,
      NOTIFICATION_PERMISSIONS.inbox.shortcode,
      NOTIFICATION_PERMISSIONS.read.shortcode,
      AUTHORIZATION_PERMISSIONS.list.shortcode,
      AUTHORIZATION_PERMISSIONS.read.shortcode,
      AUTHORIZATION_PERMISSIONS.create.shortcode,
      AUTHORIZATION_PERMISSIONS.update.shortcode,
      AUTHORIZATION_PERMISSIONS.delete.shortcode,
      AUTHORIZATION_PERMISSIONS.catalog.shortcode,
      "roles:assign",
      "patients:self",
      "plans:catalog",
      "memberships:self",
      "benefits:self",
      "prevention:self",
      "notifications:devices"
    ]
  },
  customer: {
    description: "Customer; business permissions pending definition",
    permissions: [
      AUTH_PERMISSIONS.me.shortcode,
      AUTH_PERMISSIONS.changePassword.shortcode,
      AUTH_PERMISSIONS.changeEmail.shortcode,
      NOTIFICATION_PERMISSIONS.inbox.shortcode,
      NOTIFICATION_PERMISSIONS.read.shortcode,
      "patients:self",
      "plans:catalog",
      "memberships:self",
      "benefits:self",
      "prevention:self",
      "notifications:devices"
    ]
  }
};
