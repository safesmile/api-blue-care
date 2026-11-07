import { PermissionCode } from "../../../shared/domain/permission-code";
import type { Permission } from "../../../shared/domain/permission";
export const PERSONAL_PERMISSION_CODES: readonly string[] = [
  PermissionCode.AuthMe,
  PermissionCode.AuthPasswordChange,
  PermissionCode.AuthEmailChange,
  PermissionCode.NotificationsInbox,
  PermissionCode.NotificationsRead,
  PermissionCode.NotificationsDevices,
  PermissionCode.PatientsSelf,
  PermissionCode.PlansCatalog,
  PermissionCode.MembershipsSelf,
  PermissionCode.BenefitsSelf,
  PermissionCode.PreventionSelf
];
export interface AccessActor {
  id: string;
  roles: readonly string[];
  permissions: readonly Permission[];
  clinicId?: string | null;
  clinicPermission?: Permission;
  globalPermissions?: readonly Permission[];
  globalRoles?: readonly string[];
}
/**
 * Pure policies shared by HTTP use cases and transactional persistence adapters.
 */
export class AccessPolicy {
  /**
   *
   * @param actor Authenticated caller and current effective grants.
   * @param permission Permission required for the operation.
   * @returns Result of the completed operation.
   */
  static allows(actor: AccessActor | undefined, permission: Permission) {
    return !!actor?.permissions.includes(permission);
  }
  /**
   *
   * @param actor Authenticated caller and current effective grants.
   * @param permission Permission required for the operation.
   * @param targetId Target identity identifier.
   * @returns Result of the completed operation.
   */
  static identity(actor: AccessActor | undefined, permission: Permission, targetId?: string) {
    return (
      this.allows(actor, permission) &&
      (!!actor?.permissions.includes(PermissionCode.UsersManage) || targetId === actor?.id)
    );
  }
  /**
   *
   * @param actor Authenticated caller and current effective grants.
   * @param roles Role definitions or assigned role names.
   * @returns Result of the completed operation.
   */
  static protectedAccount(actor: AccessActor | undefined, roles: readonly string[]) {
    return !roles.includes("superadmin") || !!actor?.roles.includes("superadmin");
  }
  /**
   *
   * @param actor Authenticated caller and current effective grants.
   * @param permissions Permission codes to delegate.
   * @returns Result of the completed operation.
   */
  static delegates(actor: AccessActor, permissions: readonly Permission[]) {
    return actor.roles.includes("superadmin") || permissions.every(code => actor.permissions.includes(code));
  }
}
