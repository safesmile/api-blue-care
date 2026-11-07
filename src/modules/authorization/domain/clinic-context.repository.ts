import type { Permission } from "../../../shared/domain/permission";
import type { UserView } from "../../identity/domain/user";
export interface ClinicRoleAssignment {
  clinicId: string;
  roles: string[];
}
export interface AccessibleClinic {
  id: string;
  name: string;
  roles: string[];
  permissions: Permission[];
}
export type SessionMode = "patient" | "staff";
export interface ContextUser extends UserView {
  mode: SessionMode;
  clinicId?: string | null;
  globalRoles: string[];
  globalPermissions: Permission[];
  clinics: AccessibleClinic[];
  clinicPermission?: Permission;
}
/** Resolves clinic context from current assignments rather than stale token grants. */
export abstract class ClinicContextRepository {
  abstract resolve(user: UserView, clinicId: string | null, strict: boolean, mode?: SessionMode): Promise<ContextUser>;
}
