/**
 * Adds patient-specific months in Guatemala without using the host timezone.
 * @param instant Actual completion instant.
 * @param months Interval selected for this patient.
 * @returns The next suggested preventive instant.
 */
export function nextPreventiveDate(instant: Date, months: number): Date {
  const local = new Date(instant.getTime() - 6 * 3600000);
  const month = local.getUTCMonth() + months;
  const year = local.getUTCFullYear() + Math.floor(month / 12);
  const day = Math.min(local.getUTCDate(), new Date(Date.UTC(year, (month % 12) + 1, 0)).getUTCDate());
  return new Date(
    Date.UTC(
      year,
      month % 12,
      day,
      local.getUTCHours() + 6,
      local.getUTCMinutes(),
      local.getUTCSeconds(),
      local.getUTCMilliseconds()
    )
  );
}
