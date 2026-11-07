import { PermissionCode } from "../../../shared/domain/permission-code";
export const PLANS_PERMISSION_DEFINITIONS = [
  {
    shortcode: PermissionCode.PlansCreate,
    scope: "plans.create",
    group: "plans",
    description: "create plans with explicit operation authority"
  },
  {
    shortcode: PermissionCode.PlansRead,
    scope: "plans.read",
    group: "plans",
    description: "read plans with explicit operation authority"
  },
  {
    shortcode: PermissionCode.PlansList,
    scope: "plans.list",
    group: "plans",
    description: "list plans with explicit operation authority"
  },
  {
    shortcode: PermissionCode.PlansVersion,
    scope: "plans.version",
    group: "plans",
    description: "version plans with explicit operation authority"
  },
  {
    shortcode: PermissionCode.PlansPublish,
    scope: "plans.publish",
    group: "plans",
    description: "publish plans with explicit operation authority"
  },
  {
    shortcode: PermissionCode.PlansUpdate,
    scope: "plans.update",
    group: "plans",
    description: "update plans with explicit operation authority"
  },
  {
    shortcode: PermissionCode.PlansCatalog,
    scope: "plans.catalog",
    group: "plans",
    description: "Read published plans available for contracting"
  }
] as const;
