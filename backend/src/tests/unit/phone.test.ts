/**
 * @fileoverview Normalising phone numbers to E.164.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Nothing normalised numbers before this. Validation accepted `71234567`, it
 * was stored as typed, and Twilio — which requires E.164 — rejected it. That
 * silently broke phone verification and the delivery handover code the courier
 * protocol depends on.
 */

import { normalisePhone, toE164, DEFAULT_COUNTRY } from '../../utils/phone';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

describe('normalisePhone', () => {
  describe('the ways people actually type a Botswana number', () => {
    it.each([
      ['71234567', 'bare national'],
      ['071234567', 'with the trunk zero'],
      ['71 234 567', 'with spaces'],
      ['71-234-567', 'with dashes'],
      ['+267 71 234 567', 'international with spaces'],
      ['+26771234567', 'already E.164'],
      ['0026771234567', 'with the 00 international prefix'],
      ['26771234567', 'country code, no plus'],
    ])('accepts %s (%s)', (input: string, _how: string) => {
      expect(toE164(input, 'BW')).toBe('+26771234567');
    });
  });

  it('uses the platform country when none is given', () => {
    // ARYV operates from Botswana; a number with no context is a local one.
    expect(DEFAULT_COUNTRY).toBe('BW');
    expect(toE164('71234567')).toBe('+26771234567');
  });

  it('normalises against the country it is given, not the default', () => {
    expect(toE164('821234567', 'ZA')).toBe('+27821234567');
    expect(toE164('0821234567', 'ZA')).toBe('+27821234567');
  });

  it('leaves an international number alone regardless of country', () => {
    expect(toE164('+27821234567', 'BW')).toBe('+27821234567');
  });

  describe('refuses rather than guesses', () => {
    // Sending to a wrong number is worse than not sending: for a handover code
    // it means texting a stranger someone's delivery code.
    it.each([
      [null, 'null'],
      [undefined, 'undefined'],
      ['', 'empty'],
      ['   ', 'whitespace'],
      ['not a number', 'letters only'],
      ['123', 'too short'],
      ['1234567890123456789', 'too long for E.164'],
    ])('rejects %s (%s)', (input: string | null | undefined, _why: string) => {
      expect(toE164(input as string, 'BW')).toBeNull();
    });

    it('rejects a local number for a country with no known dialing code', () => {
      const result = normalisePhone('71234567', 'XX');

      expect(result.e164).toBeNull();
      expect(result.reason).toMatch(/dialing code/i);
    });

    it('explains why, so the reason can be shown or logged', () => {
      expect(normalisePhone('123', 'BW').reason).toMatch(/short/i);
      expect(normalisePhone('', 'BW').reason).toMatch(/No number/i);
    });
  });

  describe('the rest of the region', () => {
    it.each([
      ['NA', '811234567', '+264811234567'],
      ['ZM', '971234567', '+260971234567'],
      ['ZW', '771234567', '+263771234567'],
      ['SZ', '76123456', '+26876123456'],
      ['LS', '58123456', '+26658123456'],
      ['MW', '991234567', '+265991234567'],
      ['MZ', '821234567', '+258821234567'],
      ['TZ', '712345678', '+255712345678'],
    ])('normalises a %s number', (country, input, expected) => {
      expect(toE164(input, country)).toBe(expected);
    });
  });
});
