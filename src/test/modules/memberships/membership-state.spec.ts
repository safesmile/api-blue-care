import { membershipStatus, periodEnd } from "../../../modules/memberships/domain/membership-state";
import type { MembershipRecord } from "../../../modules/memberships/domain/membership.repository";
describe("Guatemala membership anniversary and access", () => {
  it("clamps short months while retaining the original day and wall-clock time", () => {
    const anchor = new Date("2024-01-31T16:30:00.123Z");
    expect(periodEnd(anchor, 1, "monthly").toISOString()).toBe("2024-02-29T16:30:00.123Z");
    expect(periodEnd(anchor, 2, "monthly").toISOString()).toBe("2024-03-31T16:30:00.123Z");
    const nearMidnight = new Date("2026-02-01T02:00:00Z");
    expect(periodEnd(nearMidnight, 1, "monthly").toISOString()).toBe("2026-03-01T02:00:00.000Z");
  });
  it("restores a leap-day anniversary when a later year contains it", () => {
    const anchor = new Date("2024-02-29T18:00:00Z");
    expect(periodEnd(anchor, 1, "annual").toISOString()).toBe("2025-02-28T18:00:00.000Z");
    expect(periodEnd(anchor, 4, "annual").toISOString()).toBe("2028-02-29T18:00:00.000Z");
  });
  it("has no grace and preserves paid access after cancellation while suspending immediately", () => {
    const now = new Date("2026-11-04T18:00:00Z");
    const base = {
      periodStart: null,
      paidThrough: null,
      suspendedAt: null,
      cancelRequestedAt: null
    } as MembershipRecord;
    expect(membershipStatus(base, now)).toEqual({ status: "pending", eligible: false });
    const paid = { ...base, periodStart: new Date(now.getTime() - 1000), paidThrough: new Date(now.getTime() + 1000) };
    expect(membershipStatus(paid, now)).toEqual({ status: "active", eligible: true });
    expect(membershipStatus({ ...paid, cancelRequestedAt: now }, now)).toEqual({ status: "active", eligible: true });
    expect(membershipStatus({ ...paid, suspendedAt: now }, now)).toEqual({ status: "suspended", eligible: false });
    expect(membershipStatus({ ...paid, paidThrough: now }, now)).toEqual({ status: "expired", eligible: false });
    expect(membershipStatus({ ...paid, paidThrough: now, cancelRequestedAt: now }, now)).toEqual({
      status: "cancelled",
      eligible: false
    });
    expect(membershipStatus({ ...paid, periodStart: new Date(now.getTime() + 1000) }, now).eligible).toBe(false);
  });
});
