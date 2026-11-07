import { PermissionCode } from "../../../shared/domain/permission-code";
export const AUTHORIZATION_PERMISSION_DEFINITIONS = [
  {
    shortcode: PermissionCode.RolesList,
    scope: "authorization.roles.list",
    group: "Authorization",
    description: "List role definitions"
  },
  {
    shortcode: PermissionCode.RolesRead,
    scope: "authorization.roles.read",
    group: "Authorization",
    description: "Read a role definition"
  },
  {
    shortcode: PermissionCode.RolesCreate,
    scope: "authorization.roles.create",
    group: "Authorization",
    description: "Create custom roles within own grants"
  },
  {
    shortcode: PermissionCode.RolesUpdate,
    scope: "authorization.roles.update",
    group: "Authorization",
    description: "Update custom roles within own grants"
  },
  {
    shortcode: PermissionCode.RolesDelete,
    scope: "authorization.roles.delete",
    group: "Authorization",
    description: "Delete unused custom roles"
  },
  {
    shortcode: PermissionCode.PermissionsList,
    scope: "authorization.permissions.list",
    group: "Authorization",
    description: "List available permission definitions"
  }
] as const;

export const AUTHORIZATION_PERMISSIONS = {
  list: AUTHORIZATION_PERMISSION_DEFINITIONS[0],
  read: AUTHORIZATION_PERMISSION_DEFINITIONS[1],
  create: AUTHORIZATION_PERMISSION_DEFINITIONS[2],
  update: AUTHORIZATION_PERMISSION_DEFINITIONS[3],
  delete: AUTHORIZATION_PERMISSION_DEFINITIONS[4],
  catalog: AUTHORIZATION_PERMISSION_DEFINITIONS[5]
} as const;
