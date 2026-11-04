/**
 * @fileoverview Unit tests for the date-of-birth rule on users
 * @author Oabona-Majoko
 * @created 2026-11-04
 * @lastModified 2026-11-04
 *
 * The rule called getFullYear() on the value, but a DATEONLY arrives as text,
 * so saving a date of birth threw and the profile answered 500.
 */

import User from '../../models/User';

const validate = (dateOfBirth: unknown) =>
  User.build({ email: 'a@test.com', password: 'x', firstName: 'A', lastName: 'B', dateOfBirth } as any)
    .validate({ fields: ['dateOfBirth'] });

describe('User date of birth', () => {
  it('accepts an adult date of birth sent as text', async () => {
    await expect(validate('1995-05-17')).resolves.toBeDefined();
  });

  it('accepts one sent as a Date', async () => {
    await expect(validate(new Date('1990-01-01'))).resolves.toBeDefined();
  });

  it('refuses someone under 18, counting the birthday, not just the year', async () => {
    const almost = new Date();
    almost.setFullYear(almost.getFullYear() - 18);
    almost.setDate(almost.getDate() + 2);
    await expect(validate(almost.toISOString().slice(0, 10))).rejects.toThrow('at least 18');
  });

  it('refuses a date that is not a date', async () => {
    await expect(validate('not-a-date')).rejects.toThrow();
  });
});
