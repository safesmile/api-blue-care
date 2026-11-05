import { validBeneficiaryDate } from "../../../modules/benefits/domain/beneficiary-date";
describe("Beneficiary civil birth dates", () => {
  it("uses the Guatemala date when UTC has already entered the next day", () => {
    const now = new Date("2026-11-05T02:00:00Z");
    expect(validBeneficiaryDate("2026-11-04", now)).toBe(true);
    expect(validBeneficiaryDate("2026-11-05", now)).toBe(false);
    expect(validBeneficiaryDate(undefined, now)).toBe(true);
    expect(validBeneficiaryDate(null, now)).toBe(true);
    for (const value of ["", "bad", "0000-01-01", "2000-02-30", "2000-99-99"])
      expect(validBeneficiaryDate(value, now)).toBe(false);
  });
});
