import { PermissionCode } from "../../../shared/domain/permission-code";
export const AUDIT_PERMISSION_DEFINITIONS = [
  {
    shortcode: PermissionCode.AuditList,
    scope: "audit.records.list",
    group: "Audit",
    description: "List sensitive audit records"
  },
  {
    shortcode: PermissionCode.AuditRead,
    scope: "audit.records.read",
    group: "Audit",
    description: "Read a sensitive audit record"
  }
] as const;
export const AUDIT_PERMISSIONS = {
  list: AUDIT_PERMISSION_DEFINITIONS[0],
  read: AUDIT_PERMISSION_DEFINITIONS[1]
} as const;
