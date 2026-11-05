export const MEMBERSHIPS_PERMISSION_DEFINITIONS = [
  {
    shortcode: "memberships:create",
    scope: "memberships.create",
    group: "memberships",
    description: "create memberships with explicit operation authority"
  },
  {
    shortcode: "memberships:read",
    scope: "memberships.read",
    group: "memberships",
    description: "read memberships with explicit operation authority"
  },
  {
    shortcode: "memberships:list",
    scope: "memberships.list",
    group: "memberships",
    description: "list memberships with explicit operation authority"
  },
  {
    shortcode: "memberships:cancel",
    scope: "memberships.cancel",
    group: "memberships",
    description: "cancel memberships with explicit operation authority"
  },
  {
    shortcode: "memberships:suspend",
    scope: "memberships.suspend",
    group: "memberships",
    description: "suspend memberships with explicit operation authority"
  },
  {
    shortcode: "memberships:self",
    scope: "memberships.self",
    group: "memberships",
    description: "Operate on memberships of your linked patient only"
  }
] as const;
