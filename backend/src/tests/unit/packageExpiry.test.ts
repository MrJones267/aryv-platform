/**
 * @fileoverview A package closes for couriers a day after it was wanted, or in a week
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 */

import { packageExpiry, isPackageExpired, OPEN_FOR_MS, GRACE_AFTER_REQUESTED_MS } from '../../utils/packageExpiry';

const NOW = new Date('2026-11-09T12:00:00Z');

describe('packageExpiry', () => {
  it('stays open a week when no delivery time was asked for', () => {
    expect(packageExpiry(undefined, NOW).getTime()).toBe(NOW.getTime() + OPEN_FOR_MS);
  });

  it('closes a day after the requested delivery time', () => {
    const wanted = new Date('2026-11-12T09:00:00Z');
    expect(packageExpiry(wanted, NOW).getTime()).toBe(wanted.getTime() + GRACE_AFTER_REQUESTED_MS);
  });

  it('never closes sooner than a day from now, even for a time already past', () => {
    expect(packageExpiry('2026-11-01T09:00:00Z', NOW).getTime()).toBe(NOW.getTime() + GRACE_AFTER_REQUESTED_MS);
  });

  it('ignores a requested time it cannot read', () => {
    expect(packageExpiry('not a date', NOW).getTime()).toBe(NOW.getTime() + OPEN_FOR_MS);
  });
});

describe('isPackageExpired', () => {
  it('treats no expiry as open, and a past one as expired', () => {
    expect(isPackageExpired(null, NOW)).toBe(false);
    expect(isPackageExpired(new Date(NOW.getTime() - 1), NOW)).toBe(true);
    expect(isPackageExpired(new Date(NOW.getTime() + 60_000), NOW)).toBe(false);
  });
});
