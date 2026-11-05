/**
 * Optional civil birth dates cannot be impossible or later than today's Guatemala date.
 * @param value Optional civil birth date in YYYY-MM-DD format.
 * @param now Current server instant.
 * @returns Whether the optional date is valid and not in the future.
 */
export function validBeneficiaryDate(value: string | null | undefined, now = new Date()) {
  if (value === null || value === undefined) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-") || !Number.isFinite(Date.parse(value)))
    return false;
  if (new Date(value).toISOString().slice(0, 10) !== value) return false;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Guatemala",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(now)
      .map(part => [part.type, part.value])
  );
  return value <= parts.year + "-" + parts.month + "-" + parts.day;
}
