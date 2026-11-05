import { PREVENTION_PERMISSION_DEFINITIONS } from "../../prevention/domain/prevention.permissions";
import { DASHBOARD_PERMISSION_DEFINITIONS } from "../../dashboard/domain/dashboard.permissions";
import { AUDIT_PERMISSION_DEFINITIONS } from "../../audit/domain/audit.permissions";
import { BENEFITS_PERMISSION_DEFINITIONS } from "../../benefits/domain/benefits.permissions";
import { PLANS_PERMISSION_DEFINITIONS } from "../../plans/domain/plans.permissions";
import { MEMBERSHIPS_PERMISSION_DEFINITIONS } from "../../memberships/domain/memberships.permissions";
import { CLINICS_PERMISSION_DEFINITIONS } from "../../clinics/domain/clinics.permissions";
import { PATIENTS_PERMISSION_DEFINITIONS } from "../../patients/domain/patients.permissions";
import { AUTHORIZATION_PERMISSION_DEFINITIONS } from "../domain/authorization.permissions";
import { NOTIFICATION_PERMISSION_DEFINITIONS } from "../../notifications/domain/notification.permissions";
import { IDENTITY_PERMISSION_DEFINITIONS } from "../../identity/domain/identity.permissions";
import { AUTH_PERMISSION_DEFINITIONS } from "../../auth/domain/auth.permissions";
// Registration belongs to synchronization infrastructure, never to role policy configuration.
export const REGISTERED_PERMISSIONS = [
  ...IDENTITY_PERMISSION_DEFINITIONS,
  ...AUTH_PERMISSION_DEFINITIONS,
  ...NOTIFICATION_PERMISSION_DEFINITIONS,
  ...AUTHORIZATION_PERMISSION_DEFINITIONS,
  ...AUDIT_PERMISSION_DEFINITIONS,
  ...CLINICS_PERMISSION_DEFINITIONS,
  ...PATIENTS_PERMISSION_DEFINITIONS,
  ...PLANS_PERMISSION_DEFINITIONS,
  ...MEMBERSHIPS_PERMISSION_DEFINITIONS,
  ...BENEFITS_PERMISSION_DEFINITIONS,
  ...PREVENTION_PERMISSION_DEFINITIONS,
  ...DASHBOARD_PERMISSION_DEFINITIONS
];
