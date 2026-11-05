import { benefitWindow } from "../../../modules/benefits/domain/benefit-window";
describe("Individual anniversary benefit windows", () => {
  it("starts a new monthly bucket at the exact Guatemala anniversary and restores short-month days", () => {
    const anchor = new Date("2024-01-31T16:00:00Z");
    const first = benefitWindow(anchor, new Date("2024-02-29T15:59:59.999Z"), "monthly")!;
    const next = benefitWindow(anchor, new Date("2024-02-29T16:00:00Z"), "monthly")!;
    expect(first.start).toEqual(anchor);
    expect(first.end).toEqual(next.start);
    expect(next.end!.toISOString()).toBe("2024-03-31T16:00:00.000Z");
    expect(benefitWindow(anchor, new Date("2024-03-01T02:00:00Z"), "monthly")!.start).toEqual(next.start);
  });
  it("supports annual or contract-lifetime rules without changing monthly quotas for annual subscribers", () => {
    const anchor = new Date("2024-02-29T18:00:00Z"),
      now = new Date("2025-03-04T18:00:00Z");
    expect(benefitWindow(anchor, now, "annual")!.end!.toISOString()).toBe("2026-02-28T18:00:00.000Z");
    expect(benefitWindow(anchor, now, "contract")).toEqual({ start: anchor, end: null });
    expect(benefitWindow(null, now, "monthly")).toBeNull();
    expect(benefitWindow(now, anchor, "monthly")).toBeNull();
  });
});
