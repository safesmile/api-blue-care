import type { PREVENTION_PERMISSION_DEFINITIONS } from "../../modules/prevention/domain/prevention.permissions";
import type { DASHBOARD_PERMISSION_DEFINITIONS } from "../../modules/dashboard/domain/dashboard.permissions";
import type { AUDIT_PERMISSION_DEFINITIONS } from "../../modules/audit/domain/audit.permissions";
import type { BENEFITS_PERMISSION_DEFINITIONS } from "../../modules/benefits/domain/benefits.permissions";
import type { PLANS_PERMISSION_DEFINITIONS } from "../../modules/plans/domain/plans.permissions";
import type { MEMBERSHIPS_PERMISSION_DEFINITIONS } from "../../modules/memberships/domain/memberships.permissions";
import type { CLINICS_PERMISSION_DEFINITIONS } from "../../modules/clinics/domain/clinics.permissions";
import type { PATIENTS_PERMISSION_DEFINITIONS } from "../../modules/patients/domain/patients.permissions";
import type { AUTHORIZATION_PERMISSION_DEFINITIONS } from "../../modules/authorization/domain/authorization.permissions";
import type { NOTIFICATION_PERMISSION_DEFINITIONS } from "../../modules/notifications/domain/notification.permissions";
import type { IDENTITY_PERMISSION_DEFINITIONS } from "../../modules/identity/domain/identity.permissions";
import type { AUTH_PERMISSION_DEFINITIONS } from "../../modules/auth/domain/auth.permissions";
export type Permission =
  | (typeof IDENTITY_PERMISSION_DEFINITIONS)[number]["shortcode"]
  | (typeof AUTH_PERMISSION_DEFINITIONS)[number]["shortcode"]
  | (typeof NOTIFICATION_PERMISSION_DEFINITIONS)[number]["shortcode"]
  | (typeof AUTHORIZATION_PERMISSION_DEFINITIONS)[number]["shortcode"]
  | (typeof AUDIT_PERMISSION_DEFINITIONS)[number]["shortcode"]
  | (typeof CLINICS_PERMISSION_DEFINITIONS)[number]["shortcode"]
  | (typeof PATIENTS_PERMISSION_DEFINITIONS)[number]["shortcode"]
  | (typeof PLANS_PERMISSION_DEFINITIONS)[number]["shortcode"]
  | (typeof MEMBERSHIPS_PERMISSION_DEFINITIONS)[number]["shortcode"]
  | (typeof BENEFITS_PERMISSION_DEFINITIONS)[number]["shortcode"]
  | (typeof PREVENTION_PERMISSION_DEFINITIONS)[number]["shortcode"]
  | (typeof DASHBOARD_PERMISSION_DEFINITIONS)[number]["shortcode"];
export interface PermissionDefinition {
  shortcode: Permission;
  scope: string;
  group: string;
  description: string;
}
