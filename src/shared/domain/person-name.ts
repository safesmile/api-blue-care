/**
 * Validates canonical name parts without guessing how to split historical display names.
 * @param first Canonical first name.
 * @param last Canonical last name.
 * @returns Result of the completed operation.
 */
export function personName(first: string, last: string) {
  const firstName = first.trim(),
    lastName = last.trim();
  const name = (firstName + " " + lastName).trim();
  if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60 || name.length > 120) return null;
  return { firstName, lastName, name };
}
