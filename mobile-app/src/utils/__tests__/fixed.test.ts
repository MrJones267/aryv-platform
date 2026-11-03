/**
 * @fileoverview Formatting numbers from whatever the server sent
 * @author Oabona-Majoko
 * @created 2026-11-03
 * @lastModified 2026-11-03
 *
 * DECIMAL columns arrived as strings and ratings can be null; `toFixed` threw
 * on both, crashing Ride Details and the Book button.
 */

import { fixed } from '../fixed';

describe('fixed', () => {
  it('formats numbers and numeric text alike', () => {
    expect(fixed(150, 2)).toBe('150.00');
    expect(fixed('150.00', 2)).toBe('150.00');
    expect(fixed('4.756', 1)).toBe('4.8');
    expect(fixed(126.5, 0)).toBe('127');
  });

  it('falls back instead of throwing on a missing or non-numeric value', () => {
    expect(fixed(null, 1, '–')).toBe('–');
    expect(fixed(undefined, 2)).toBe('0.00');
    expect(fixed('', 2)).toBe('0.00');
    expect(fixed('abc', 2)).toBe('0.00');
    expect(fixed(NaN, 1, '–')).toBe('–');
  });
});
