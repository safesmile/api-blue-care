import { periodEnd } from "../../memberships/domain/membership-state";
import type { BenefitPeriod } from "./benefit.repository";
/**
 * Uses monthly anniversaries even when billing is annual. No unused units carry into a new window.
 * @param anchor Original first-paid Guatemala anniversary.
 * @param now Current server instant.
 * @param period Stable quota reset interval.
 * @returns The current quota window, or null before the first paid anniversary.
 */
export function benefitWindow(
  anchor: Date | null,
  now: Date,
  period: BenefitPeriod
): { start: Date; end: Date | null } | null {
  if (!anchor || now < anchor) return null;
  if (period === "contract") return { start: anchor, end: null };
  // UTC month differences are only an estimate; Guatemala anniversary instants determine the final bucket.
  const stride = period === "annual" ? 12 : 1;
  let index = Math.max(
    0,
    Math.floor(
      ((now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + now.getUTCMonth() - anchor.getUTCMonth()) / stride
    )
  );
  const boundary = (n: number) => periodEnd(anchor, n, period === "annual" ? "annual" : "monthly");
  while (index > 0 && boundary(index) > now) index--;
  while (boundary(index + 1) <= now) index++;
  return { start: boundary(index), end: boundary(index + 1) };
}
