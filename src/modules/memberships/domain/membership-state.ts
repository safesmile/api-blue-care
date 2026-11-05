import type { Cadence, MembershipRecord, MembershipView } from "./membership.repository";
const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Guatemala",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});
/**
 * Extracts civil time without depending on the server timezone.
 * @param date UTC instant to convert to Guatemala civil time.
 * @returns The persisted result or completion of the authorized operation.
 */
function localTime(date: Date) {
  const p = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second };
}
/**
 * Uses the original Guatemala anniversary, including after a short month or leap year.
 * @param anchor Original first-paid anniversary instant.
 * @param number Paid period number from the original anniversary.
 * @param cadence Immutable monthly or annual billing interval.
 * @returns The persisted result or completion of the authorized operation.
 */
export function periodEnd(anchor: Date, number: number, cadence: Cadence): Date {
  const p = localTime(anchor),
    month = p.month - 1 + number * (cadence === "annual" ? 12 : 1);
  const year = p.year + Math.floor(month / 12),
    targetMonth = month % 12;
  const day = Math.min(p.day, new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate());
  const civil = Date.UTC(year, targetMonth, day, p.hour, p.minute, p.second, anchor.getUTCMilliseconds());
  let candidate = civil;
  for (let i = 0; i < 3; i++) {
    const actual = localTime(new Date(candidate));
    const rendered = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      anchor.getUTCMilliseconds()
    );
    candidate += civil - rendered;
  }
  return new Date(candidate);
}
/**
 * Evaluates access on every read; expiration has no grace period or timer dependency.
 * @param record Persisted contractual state.
 * @param now Current instant used to evaluate access.
 * @returns The persisted result or completion of the authorized operation.
 */
export function membershipStatus(
  record: MembershipRecord,
  now = new Date()
): Pick<MembershipView, "status" | "eligible"> {
  const paid = !!record.periodStart && !!record.paidThrough && record.periodStart <= now && record.paidThrough > now;
  const status = record.closedAt
    ? "cancelled"
    : record.suspendedAt
      ? "suspended"
      : record.cancelRequestedAt && !paid
        ? "cancelled"
        : !record.paidThrough
          ? "pending"
          : paid
            ? "active"
            : "expired";
  return { status, eligible: paid && !record.suspendedAt && !record.closedAt };
}
