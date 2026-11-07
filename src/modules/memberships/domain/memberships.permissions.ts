import { PermissionCode } from "../../../shared/domain/permission-code";
export const MEMBERSHIPS_PERMISSION_DEFINITIONS = [
  {
    shortcode: PermissionCode.MembershipsCreate,
    scope: "memberships.create",
    group: "memberships",
    description: "create memberships with explicit operation authority"
  },
  {
    shortcode: PermissionCode.MembershipsRead,
    scope: "memberships.read",
    group: "memberships",
    description: "read memberships with explicit operation authority"
  },
  {
    shortcode: PermissionCode.MembershipsList,
    scope: "memberships.list",
    group: "memberships",
    description: "list memberships with explicit operation authority"
  },
  {
    shortcode: PermissionCode.MembershipsCancel,
    scope: "memberships.cancel",
    group: "memberships",
    description: "cancel memberships with explicit operation authority"
  },
  {
    shortcode: PermissionCode.MembershipsSuspend,
    scope: "memberships.suspend",
    group: "memberships",
    description: "suspend memberships with explicit operation authority"
  },
  {
    shortcode: PermissionCode.MembershipsSelf,
    scope: "memberships.self",
    group: "memberships",
    description: "Operate on memberships of your linked patient only"
  }
] as const;
