/**
 * @fileoverview Platform fee rates.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Rates are percentages, deliberately. A percentage carries across currencies
 * without needing a rate: ten percent of a Pula fare and ten percent of a Rand
 * fare are both ten percent.
 *
 * A cash cap does not. The commission cap used to be a bare `10.00`, which
 * meant ten Pula in Botswana and ten dollars in South Africa — the same number
 * standing for roughly thirteen times the value, with nothing saying which.
 * Converting it at the point of use worked, but made every fee calculation
 * depend on a live exchange rate, and made the fee a driver pays vary with the
 * currency market rather than with the fare. Dropping the cap removes both
 * problems and is easier to explain to a driver: the platform takes a fixed
 * share of what you collected.
 */

/** Commission taken from a driver on a cash ride. */
export const CASH_COMMISSION_RATE = 0.10;

/** Platform fee added to a booking. */
export const BOOKING_PLATFORM_FEE_RATE = 0.05;

/**
 * Whether an amount of money has at most two decimal places. Compared with a
 * tolerance: 19.99 * 100 is 1998.9999999999998 in floating point, so an exact
 * comparison refused 19.99, 1.15 and 0.07 as having too many decimals.
 */
export const hasAtMostTwoDecimals = (amount: number): boolean =>
  Number.isFinite(amount) && Math.abs(Math.round(amount * 100) - amount * 100) < 1e-6;

/**
 * Platform share of a courier delivery when the package has no delivery tier.
 * A package with a tier uses that tier's platform_fee_percentage instead.
 */
export const DEFAULT_COURIER_FEE_RATE = 0.25;

export const round2 = (value: number): number => Math.round(value * 100) / 100;
