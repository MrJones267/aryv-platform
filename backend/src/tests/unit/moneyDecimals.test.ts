/**
 * @fileoverview Amounts with at most two decimal places
 * @author Oabona-Majoko
 * @created 2026-11-10
 * @lastModified 2026-11-10
 */

import { hasAtMostTwoDecimals } from '../../utils/fees';

describe('hasAtMostTwoDecimals', () => {
  it.each([19.99, 1.15, 0.07, 100.1, 250.55, 35.5, 40, 0.01])('accepts %p', (amount) => {
    expect(hasAtMostTwoDecimals(amount)).toBe(true);
  });

  it.each([19.999, 0.001, 1.005, NaN, Infinity])('refuses %p', (amount) => {
    expect(hasAtMostTwoDecimals(amount)).toBe(false);
  });
});
