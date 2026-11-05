export const AUDIT_PERMISSION_DEFINITIONS = [
  { shortcode: "audit:list", scope: "audit.records.list", group: "Audit", description: "List sensitive audit records" },
  { shortcode: "audit:read", scope: "audit.records.read", group: "Audit", description: "Read a sensitive audit record" }
] as const;
export const AUDIT_PERMISSIONS = {
  list: AUDIT_PERMISSION_DEFINITIONS[0],
  read: AUDIT_PERMISSION_DEFINITIONS[1]
} as const;
