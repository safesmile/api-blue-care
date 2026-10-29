export const IDENTITY_PERMISSION_DEFINITIONS = [
  {
    shortcode: "roles:assign",
    scope: "identity.roles.assign",
    group: "Users",
    description: "Assign roles to users and invitations"
  },
  {
    shortcode: "users:create",
    scope: "identity.users.create",
    group: "Users",
    description: "Create users and assign roles"
  },
  {
    shortcode: "users:read",
    scope: "identity.users.read",
    group: "Users",
    description: "Read a user"
  },
  {
    shortcode: "users:list",
    scope: "identity.users.list",
    group: "Users",
    description: "List users"
  },
  {
    shortcode: "users:update",
    scope: "identity.users.update",
    group: "Users",
    description: "Update users and their roles"
  },
  {
    shortcode: "users:delete",
    scope: "identity.users.delete",
    group: "Users",
    description: "Delete users"
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
