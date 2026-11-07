import { PermissionCode } from "./shared/domain/permission-code";
import { AUTHORIZATION_PERMISSIONS } from "./modules/authorization/domain/authorization.permissions";
import { NOTIFICATION_PERMISSIONS } from "./modules/notifications/domain/notification.permissions";
import { AUTH_PERMISSIONS } from "./modules/auth/domain/auth.permissions";
import type { Permission } from "./shared/domain/permission";
export const DEFAULT_ROLE_NAMES = ["superadmin", "admin", "customer", "staff"] as const;
export type DefaultRoleName = (typeof DEFAULT_ROLE_NAMES)[number];
export type RoleName = string;
// This file defines role policies only. Each module owns its permission definitions.
export const DEFAULT_ROLE_PERMISSIONS: Record<
  DefaultRoleName,
  { description: string; permissions: "*" | readonly Permission[] }
> = {
  superadmin: { description: "Full access to every registered module permission", permissions: "*" },
  admin: {
    description: "Administrator; patient directory access is limited to assigned clinics",
    permissions: [
      AUTH_PERMISSIONS.me.shortcode,
      AUTH_PERMISSIONS.changePassword.shortcode,
      AUTH_PERMISSIONS.changeEmail.shortcode,
      NOTIFICATION_PERMISSIONS.inbox.shortcode,
      NOTIFICATION_PERMISSIONS.read.shortcode,
      AUTHORIZATION_PERMISSIONS.list.shortcode,
      AUTHORIZATION_PERMISSIONS.read.shortcode,
      AUTHORIZATION_PERMISSIONS.create.shortcode,
      AUTHORIZATION_PERMISSIONS.update.shortcode,
      AUTHORIZATION_PERMISSIONS.delete.shortcode,
      AUTHORIZATION_PERMISSIONS.catalog.shortcode,
      PermissionCode.RolesAssign,
      PermissionCode.ClinicsStaffManage,
      PermissionCode.ClinicsAll,
      PermissionCode.ClinicsStaffList,
      PermissionCode.ClinicsList,
      PermissionCode.ClinicsRead,
      PermissionCode.InvitationsCreate,
      PermissionCode.InvitationsList,
      PermissionCode.InvitationsResend,
      PermissionCode.InvitationsRevoke,
      PermissionCode.PatientsList,
      PermissionCode.PatientsRead,
      PermissionCode.PatientsCreate,
      PermissionCode.PatientsLink,
      PermissionCode.PatientsSelf,
      PermissionCode.PlansCatalog,
      PermissionCode.MembershipsSelf,
      PermissionCode.BenefitsSelf,
      PermissionCode.PreventionSelf,
      PermissionCode.NotificationsDevices
    ]
  },
  staff: {
    description: "Collaborator account security and notifications; clinic roles grant work access",
    permissions: [
      PermissionCode.AuthMe,
      PermissionCode.AuthPasswordChange,
      PermissionCode.AuthEmailChange,
      PermissionCode.NotificationsInbox,
      PermissionCode.NotificationsRead,
      PermissionCode.NotificationsDevices
    ]
  },
  customer: {
    description: "Customer; business permissions pending definition",
    permissions: [
      AUTH_PERMISSIONS.me.shortcode,
      AUTH_PERMISSIONS.changePassword.shortcode,
      AUTH_PERMISSIONS.changeEmail.shortcode,
      NOTIFICATION_PERMISSIONS.inbox.shortcode,
      NOTIFICATION_PERMISSIONS.read.shortcode,
      PermissionCode.PatientsSelf,
      PermissionCode.PlansCatalog,
      PermissionCode.MembershipsSelf,
      PermissionCode.BenefitsSelf,
      PermissionCode.PreventionSelf,
      PermissionCode.NotificationsDevices
    ]
  }
};
