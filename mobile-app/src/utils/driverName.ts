/**
 * @fileoverview How to render a driver's name from whichever shape the server
 *               sent.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * Ride search and the public ride detail no longer include a driver's surname
 * — a stranger sweeping the search endpoint could otherwise assemble a list of
 * full names against exact pickup points and times. Those responses carry
 * `displayName` ("Kagiso M.") instead. Once you hold a booking, the full
 * record comes back and `lastName` is present again.
 *
 * Screens should not care which of the two they were handed, and must never
 * concatenate a missing surname into the UI as "Kagiso undefined".
 */

export interface DriverNameFields {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}

/** The best available name, never containing "undefined" or a trailing space. */
export const driverDisplayName = (
  driver: DriverNameFields | null | undefined,
  fallback = 'Driver',
): string => {
  if (!driver) return fallback;

  if (driver.displayName && driver.displayName.trim()) {
    return driver.displayName.trim();
  }

  const name = [driver.firstName, driver.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .trim();

  return name || fallback;
};

export default driverDisplayName;
