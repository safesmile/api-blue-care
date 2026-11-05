import type { AuditSnapshot, AuditValue } from "./audit.repository";
const sensitive = /password|token|secret|authorization|cookie|credential/i;
/**
 * Defense in depth; modules also explicitly select the business fields that may be recorded.
 * @param value Snapshot input to sanitize.
 * @param depth Current recursion depth.
 * @returns Result of the completed operation.
 */
export function sanitizeSnapshot(value: unknown, depth = 0): AuditValue {
  if (depth > 6) return null;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(item => sanitizeSnapshot(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, item]) => !sensitive.test(key) && item !== undefined)
        .map(([key, item]) => [key, sanitizeSnapshot(item, depth + 1)])
    );
  }
  return null;
}
/**
 * Captures only the fields explicitly approved by the originating module.
 * @param value Snapshot input to sanitize.
 * @param fields Explicit allowlist owned by the originating module.
 * @returns Result of the completed operation.
 */
export function auditSnapshot(value: object | null, fields: readonly string[]): AuditSnapshot | null {
  if (!value) return null;
  return sanitizeSnapshot(
    Object.fromEntries(
      fields.filter(key => Object.hasOwn(value, key)).map(key => [key, (value as Record<string, unknown>)[key]])
    )
  ) as AuditSnapshot;
}
