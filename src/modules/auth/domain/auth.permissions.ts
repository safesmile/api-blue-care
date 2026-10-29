export const AUTH_PERMISSION_DEFINITIONS = [
  {
    shortcode: "invitations:create",
    scope: "auth.invitations.create",
    group: "Authentication",
    description: "Invite users with explicit roles"
  },
  {
    shortcode: "auth:me",
    scope: "auth.profile.read",
    group: "Authentication",
    description: "Read the authenticated profile"
  },
  {
    shortcode: "invitations:list",
    scope: "auth.invitations.list",
    group: "Authentication",
    description: "List invitation history"
  },
  {
    shortcode: "invitations:resend",
    scope: "auth.invitations.resend",
    group: "Authentication",
    description: "Resend invitations"
  },
  {
    shortcode: "invitations:revoke",
    scope: "auth.invitations.revoke",
    group: "Authentication",
    description: "Revoke invitations"
  },
  {
    shortcode: "auth:password-change",
    scope: "auth.password.change",
    group: "Authentication",
    description: "Change own password"
  },
  {
    shortcode: "auth:email-change",
    scope: "auth.email.change",
    group: "Authentication",
    description: "Verify a new own email"
  }
] as const;
export const AUTH_PERMISSIONS = {
  invite: AUTH_PERMISSION_DEFINITIONS[0],
  me: AUTH_PERMISSION_DEFINITIONS[1],
  listInvitations: AUTH_PERMISSION_DEFINITIONS[2],
  resendInvitation: AUTH_PERMISSION_DEFINITIONS[3],
  revokeInvitation: AUTH_PERMISSION_DEFINITIONS[4],
  changePassword: AUTH_PERMISSION_DEFINITIONS[5],
  changeEmail: AUTH_PERMISSION_DEFINITIONS[6]
} as const;
