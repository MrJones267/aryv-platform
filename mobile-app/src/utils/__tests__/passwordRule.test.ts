/**
 * @fileoverview Sign-up accepts the same passwords as the server
 * @author Oabona-Majoko
 * @created 2026-11-04
 * @lastModified 2026-11-04
 */

import { passwordProblem } from '../passwordRule';

describe('passwordProblem', () => {
  it('takes any symbol, as the server does', () => {
    // All refused before: only @$!%*?& counted, and any other character failed.
    for (const password of ['Password#1', 'Passw0rd.', 'My_Secret9', 'Kgosi-2026', 'Two Words1!', 'Pula€2026a']) {
      expect(passwordProblem(password)).toBeNull();
    }
  });

  it('still takes the symbols it took before', () => {
    expect(passwordProblem('Strong@Pass1')).toBeNull();
  });

  it('says what is missing', () => {
    expect(passwordProblem('')).toBe('required');
    expect(passwordProblem('Ab1#')).toBe('too_short');
    expect(passwordProblem('a'.repeat(129) + 'A1#')).toBe('too_long');
    expect(passwordProblem('password#1')).toBe('needs_mix'); // no uppercase
    expect(passwordProblem('PASSWORD#1')).toBe('needs_mix'); // no lowercase
    expect(passwordProblem('Password#!')).toBe('needs_mix'); // no number
    expect(passwordProblem('Password12')).toBe('needs_mix'); // no symbol
  });
});
