/**
 * @fileoverview The password rule, the same as the server's.
 * @author Oabona-Majoko
 * @created 2026-11-04
 * @lastModified 2026-11-04
 *
 * Sign-up allowed only @$!%*?& as symbols, and refused a password with any
 * other character in it, so "Password#1" or "Passw0rd." was turned down on
 * the phone with "must contain a special character", though it has one,
 * and Create Account stayed greyed out. The server (backend/src/utils/
 * password.ts) takes any symbol.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordProblem = 'required' | 'too_short' | 'too_long' | 'needs_mix';

/** What is wrong with a password, or null when the server will take it. */
export function passwordProblem(password: string): PasswordProblem | null {
  if (!password) return 'required';
  if (password.length < PASSWORD_MIN_LENGTH) return 'too_short';
  if (password.length > PASSWORD_MAX_LENGTH) return 'too_long';
  const hasMix = /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
  return hasMix ? null : 'needs_mix';
}

export default passwordProblem;
