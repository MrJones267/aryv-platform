/**
 * @fileoverview One password policy, applied everywhere a password is set.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * Registration enforced a genuine policy through its Joi schema — mixed case,
 * a digit, a symbol — while the OTP password-reset path checked only that the
 * string was eight characters long. An account could therefore be moved to a
 * weaker password than it could have been created with, which quietly undoes
 * the policy for anyone who goes through a reset.
 */

// Constants
export const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/**
 * Lowercase, uppercase, digit, and at least one character that is none of
 * those.
 *
 * The original pattern also *restricted* the allowed alphabet to
 * `[A-Za-z\d@$!%*?&]`, which silently rejected perfectly good passwords —
 * anything containing `#`, `-`, a space, or a non-Latin letter. Requiring a
 * non-alphanumeric without capping the alphabet keeps every requirement and
 * stops turning strong passwords away.
 */
const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /\d/;
const HAS_SYMBOL = /[^A-Za-z0-9]/;

export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export interface PasswordCheck {
  ok: boolean;
  message?: string;
}

export const validatePasswordStrength = (password: unknown): PasswordCheck => {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, message: 'A password is required' };
  }

  if (password.length < MIN_LENGTH) {
    return { ok: false, message: `Password must be at least ${MIN_LENGTH} characters` };
  }

  if (password.length > MAX_LENGTH) {
    return { ok: false, message: `Password must be at most ${MAX_LENGTH} characters` };
  }

  const missing: string[] = [];
  if (!HAS_LOWER.test(password)) missing.push('a lowercase letter');
  if (!HAS_UPPER.test(password)) missing.push('an uppercase letter');
  if (!HAS_DIGIT.test(password)) missing.push('a number');
  if (!HAS_SYMBOL.test(password)) missing.push('a symbol');

  if (missing.length > 0) {
    return { ok: false, message: `Password must contain ${missing.join(', ')}` };
  }

  return { ok: true };
};

export default validatePasswordStrength;
