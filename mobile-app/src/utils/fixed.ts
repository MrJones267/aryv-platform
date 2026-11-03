/**
 * @fileoverview Format a number from whatever the server sent.
 * @author Oabona-Majoko
 * @created 2026-11-03
 * @lastModified 2026-11-03
 *
 * Prices, totals, ratings and distances are DECIMAL columns, which the server
 * sent as strings ("150.00") until 2026-11-03, and a rating is null until a
 * driver's first review. `value.toFixed(2)` threw on either: Ride Details
 * showed "Something went wrong" and tapping Book closed the app.
 */

/**
 * `value` to `digits` decimal places, or `fallback` when it is not a number.
 *
 * @example fixed('150.00', 2) // '150.00'
 * @example fixed(null, 1, '–') // '–'
 */
export const fixed = (value: unknown, digits: number, fallback = (0).toFixed(digits)): string => {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(number) ? number.toFixed(digits) : fallback;
};

export default fixed;
