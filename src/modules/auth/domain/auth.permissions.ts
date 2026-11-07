import { PermissionCode } from "../../../shared/domain/permission-code";
export const AUTH_PERMISSION_DEFINITIONS = [
  {
    shortcode: PermissionCode.InvitationsCreate,
    scope: "auth.invitations.create",
    group: "Authentication",
    description: "Invite users with explicit roles"
  },
  {
    shortcode: PermissionCode.AuthMe,
    scope: "auth.profile.read",
    group: "Authentication",
    description: "Read the authenticated profile"
  },
  {
    shortcode: PermissionCode.InvitationsList,
    scope: "auth.invitations.list",
    group: "Authentication",
    description: "List invitation history"
  },
  {
    shortcode: PermissionCode.InvitationsResend,
    scope: "auth.invitations.resend",
    group: "Authentication",
    description: "Resend invitations"
  },
  {
    shortcode: PermissionCode.InvitationsRevoke,
    scope: "auth.invitations.revoke",
    group: "Authentication",
    description: "Revoke invitations"
  },
  {
    shortcode: PermissionCode.AuthPasswordChange,
    scope: "auth.password.change",
    group: "Authentication",
    description: "Change own password"
  },
  {
    shortcode: PermissionCode.AuthEmailChange,
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
