/**
 * @fileoverview Platform fee rates.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * The cash commission cap used to be a bare `10.00` — ten Pula in Botswana and
 * ten dollars in South Africa. It is now a plain percentage, which carries
 * across currencies without needing an exchange rate at all.
 */

import { CASH_COMMISSION_RATE, BOOKING_PLATFORM_FEE_RATE, round2 } from '../../utils/fees';

describe('platform fee rates', () => {
  it('expresses fees as percentages, so they need no currency', () => {
    expect(CASH_COMMISSION_RATE).toBe(0.1);
    expect(BOOKING_PLATFORM_FEE_RATE).toBe(0.05);
  });

  it('takes the same share regardless of currency', () => {
    // The point of dropping the cap: 200 Pula and 200 Rand are different sums
    // of money, and ten percent of each is the right answer for each.
    expect(round2(200 * CASH_COMMISSION_RATE)).toBe(20);
    expect(round2(2000 * CASH_COMMISSION_RATE)).toBe(200);
  });

  it('does not cap, so a large fare pays proportionally', () => {
    // Under the old cap this was 10 — a 0.5% effective rate on a long
    // intercity run, which is the trip the platform does most work for.
    expect(round2(2000 * CASH_COMMISSION_RATE)).not.toBe(10);
  });

  it('rounds to the minor unit', () => {
    expect(round2(33.333)).toBe(33.33);
    expect(round2(33.335)).toBe(33.34);
    expect(round2(99.999)).toBe(100);
  });
});
