import { nextPreventiveDate } from "../../../modules/prevention/domain/prevention-calendar";
describe("Patient preventive calendar", () => {
  it("clamps short months in Guatemala and preserves the local instant", () => {
    expect(nextPreventiveDate(new Date("2026-12-01T04:00:00Z"), 3).toISOString()).toBe("2027-03-01T04:00:00.000Z");
    expect(nextPreventiveDate(new Date("2027-01-31T16:30:00Z"), 1).toISOString()).toBe("2027-02-28T16:30:00.000Z");
    expect(nextPreventiveDate(new Date("2028-02-29T16:30:00Z"), 12).toISOString()).toBe("2029-02-28T16:30:00.000Z");
  });
});
