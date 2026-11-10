/**
 * @fileoverview An approved driver counts as one whatever role they signed up with
 * @author Oabona-Majoko
 * @created 2026-11-10
 * @lastModified 2026-11-10
 */

import { driverStanding } from '../driverStanding';

describe('driverStanding', () => {
  it('goes by approval, not the role chosen at sign-up', () => {
    expect(driverStanding({ driverVerificationStatus: 'verified', roles: ['passenger'] })).toBe('approved');
    expect(driverStanding({ driverVerificationStatus: 'unverified', roles: ['driver'] })).toBe('none');
  });

  it('knows an application under review or suspended', () => {
    expect(driverStanding({ driverVerificationStatus: 'pending' })).toBe('under_review');
    expect(driverStanding({ driverVerificationStatus: 'suspended' })).toBe('suspended');
    expect(driverStanding({ driverVerificationStatus: 'rejected' })).toBe('none');
  });

  it('falls back to the role when the server sends no status', () => {
    expect(driverStanding({ roles: ['driver'] })).toBe('approved');
    expect(driverStanding({ roles: ['passenger'] })).toBe('none');
    expect(driverStanding(null)).toBe('none');
  });
});
