export const PLANS_PERMISSION_DEFINITIONS = [
  {
    shortcode: "plans:create",
    scope: "plans.create",
    group: "plans",
    description: "create plans with explicit operation authority"
  },
  {
    shortcode: "plans:read",
    scope: "plans.read",
    group: "plans",
    description: "read plans with explicit operation authority"
  },
  {
    shortcode: "plans:list",
    scope: "plans.list",
    group: "plans",
    description: "list plans with explicit operation authority"
  },
  {
    shortcode: "plans:version",
    scope: "plans.version",
    group: "plans",
    description: "version plans with explicit operation authority"
  },
  {
    shortcode: "plans:publish",
    scope: "plans.publish",
    group: "plans",
    description: "publish plans with explicit operation authority"
  },
  {
    shortcode: "plans:update",
    scope: "plans.update",
    group: "plans",
    description: "update plans with explicit operation authority"
  },
  {
    shortcode: "plans:catalog",
    scope: "plans.catalog",
    group: "plans",
    description: "Read published plans available for contracting"
  }
] as const;
