/**
 * @fileoverview Normalising phone numbers to E.164 before they reach a carrier.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Nothing normalised phone numbers. Validation accepted `+?[1-9]\d{1,14}`, so
 * `71234567` passed, was stored as typed, and went straight to Twilio — which
 * requires E.164 and rejects anything else. The message was never delivered
 * and the failure surfaced only as a Twilio error in the logs.
 *
 * That silently broke both things that depend on SMS: phone verification, and
 * the delivery handover code the whole courier protocol rests on. People do
 * not type their own number in E.164 — they write 71234567, 71 234 567,
 * 0267..., or +267-71-234-567.
 */

import { logWarning } from './logger';

/** Where ARYV operates. Used when a number has no country context of its own. */
export const DEFAULT_COUNTRY = 'BW';

/**
 * Dialing prefixes for the region, plus the handful of others that appear in
 * the seeded country data. Kept here rather than read per-call: this runs on
 * the SMS path, and a missing row must not stop a message going out.
 */
export const DIALING_CODES: Record<string, string> = {
  BW: '267', // Botswana
  ZA: '27', // South Africa
  NA: '264', // Namibia
  ZM: '260', // Zambia
  ZW: '263', // Zimbabwe
  SZ: '268', // Eswatini
  LS: '266', // Lesotho
  MW: '265', // Malawi
  MZ: '258', // Mozambique
  AO: '244', // Angola
  TZ: '255', // Tanzania
  KE: '254',
  NG: '234',
  US: '1',
  GB: '44',
};

/**
 * National trunk prefixes to strip once the country is known. Most of the
 * region uses a leading 0 for domestic dialing, which is not part of the
 * international number.
 */
const TRUNK_PREFIX = '0';

export interface NormaliseResult {
  /** E.164, or null when the input cannot be resolved to one. */
  e164: string | null;
  /** Why it could not be resolved, for logs and for telling the user. */
  reason?: string;
}

/**
 * Convert a phone number as a human typed it into E.164.
 *
 * Returns null rather than a guess when the result would be doubtful: sending
 * to a wrong number is worse than not sending, and for the handover code it
 * would mean texting a stranger someone's delivery code.
 */
export const normalisePhone = (
  raw: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY,
): NormaliseResult => {
  if (!raw || typeof raw !== 'string') {
    return { e164: null, reason: 'No number supplied' };
  }

  // Keep digits and a single leading plus; people type spaces, dashes and
  // brackets.
  const trimmed = raw.trim();
  const hadPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return { e164: null, reason: 'Number contains no digits' };
  }

  // 00 is the other way of writing +.
  if (!hadPlus && digits.startsWith('00')) {
    digits = digits.slice(2);
    return finalise(digits);
  }

  if (hadPlus) {
    return finalise(digits);
  }

  const dialing = DIALING_CODES[countryCode?.toUpperCase() ?? ''];

  if (!dialing) {
    logWarning('No dialing code known for country; cannot normalise number', {
      countryCode,
    });
    return { e164: null, reason: `No dialing code known for ${countryCode}` };
  }

  // Already carries its own country code, written without a plus.
  if (digits.startsWith(dialing) && digits.length > dialing.length + 4) {
    return finalise(digits);
  }

  // Domestic form: strip the trunk prefix and prepend the country code.
  const national = digits.startsWith(TRUNK_PREFIX) ? digits.slice(1) : digits;

  if (national.length < 6) {
    return { e164: null, reason: 'Number is too short to be a mobile number' };
  }

  return finalise(`${dialing}${national}`);
};

const finalise = (digits: string): NormaliseResult => {
  // E.164 allows at most 15 digits, and nothing real is under 8 with a country
  // code attached.
  if (digits.length < 8 || digits.length > 15) {
    return { e164: null, reason: 'Number is not a valid international length' };
  }
  return { e164: `+${digits}` };
};

/** Convenience for call sites that only care about the result. */
export const toE164 = (
  raw: string | null | undefined,
  countryCode?: string,
): string | null => normalisePhone(raw, countryCode).e164;

export default normalisePhone;
