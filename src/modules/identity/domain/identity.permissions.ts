import { PermissionCode } from "../../../shared/domain/permission-code";
export const IDENTITY_PERMISSION_DEFINITIONS = [
  {
    shortcode: PermissionCode.RolesAssign,
    scope: "identity.roles.assign",
    group: "Users",
    description: "Assign roles to users and invitations"
  },
  {
    shortcode: PermissionCode.UsersCreate,
    scope: "identity.users.create",
    group: "Users",
    description: "Create users and assign roles"
  },
  {
    shortcode: PermissionCode.UsersRead,
    scope: "identity.users.read",
    group: "Users",
    description: "Read a user"
  },
  {
    shortcode: PermissionCode.UsersList,
    scope: "identity.users.list",
    group: "Users",
    description: "List users"
  },
  {
    shortcode: PermissionCode.UsersUpdate,
    scope: "identity.users.update",
    group: "Users",
    description: "Update users and their roles"
  },
  {
    shortcode: PermissionCode.UsersDelete,
    scope: "identity.users.delete",
    group: "Users",
    description: "Delete users"
  },
  {
    shortcode: PermissionCode.UsersManage,
    scope: "identity.users.manage",
    group: "Users",
    description: "Operate across user identities in addition to operation permissions"
  }
] as const;
export const IDENTITY_PERMISSIONS = {
  assignRoles: IDENTITY_PERMISSION_DEFINITIONS[0],
  create: IDENTITY_PERMISSION_DEFINITIONS[1],
  read: IDENTITY_PERMISSION_DEFINITIONS[2],
  list: IDENTITY_PERMISSION_DEFINITIONS[3],
  update: IDENTITY_PERMISSION_DEFINITIONS[4],
  delete: IDENTITY_PERMISSION_DEFINITIONS[5]
} as const;
