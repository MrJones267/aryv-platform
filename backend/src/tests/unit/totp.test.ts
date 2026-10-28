/**
 * @fileoverview TOTP codes, checked against RFC 6238's own test vectors.
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * Admin two-factor sign-in depends on producing exactly the code an
 * authenticator app shows. The RFC publishes the expected codes for a known
 * secret at known times; if these pass, so does every standard app.
 */

import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  timeStep,
  totpForStep,
  verifyTotp,
} from '../../utils/totp';

// RFC 6238 appendix B: the SHA-1 secret is the ASCII string "12345678901234567890".
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');
const RFC_VECTORS: Array<[number, string]> = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

describe('totp', () => {
  it.each(RFC_VECTORS)('matches RFC 6238 at %i seconds', (seconds, expected) => {
    expect(totpForStep(RFC_SECRET, timeStep(seconds * 1000), 8)).toBe(expected);
  });

  it('gives the last six digits of the RFC codes when six are asked for', () => {
    expect(totpForStep(RFC_SECRET, timeStep(59 * 1000))).toBe('287082');
  });

  it('round-trips base32 the way authenticator apps encode secrets', () => {
    // RFC 4648 test vector.
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
    expect(base32Decode('mzxw 6ytb oi').toString()).toBe('foobar');
  });

  it('generates a 160-bit secret', () => {
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });

  describe('verifyTotp', () => {
    const secret = base32Encode(RFC_SECRET);
    const at = 1234567890 * 1000;
    const codeFor = (offsetSteps: number) => totpForStep(RFC_SECRET, timeStep(at) + offsetSteps);

    it('accepts the current code and returns its step', () => {
      expect(verifyTotp(secret, codeFor(0), at)).toBe(timeStep(at));
    });

    it('accepts one step either side, for a phone clock that drifts', () => {
      expect(verifyTotp(secret, codeFor(-1), at)).toBe(timeStep(at) - 1);
      expect(verifyTotp(secret, codeFor(1), at)).toBe(timeStep(at) + 1);
    });

    it('refuses codes from further away', () => {
      expect(verifyTotp(secret, codeFor(2), at)).toBeNull();
      expect(verifyTotp(secret, codeFor(-2), at)).toBeNull();
    });

    it.each(['', '12345', '1234567', 'abcdef', '12 345'])('refuses the malformed code %p', code => {
      expect(verifyTotp(secret, code, at)).toBeNull();
    });
  });

  it('builds the otpauth URI apps read from the QR code', () => {
    expect(otpauthUri('ARYV Admin', 'ops@aryv-app.com', 'JBSWY3DPEHPK3PXP')).toBe(
      'otpauth://totp/ARYV%20Admin%3Aops%40aryv-app.com?secret=JBSWY3DPEHPK3PXP&issuer=ARYV%20Admin&algorithm=SHA1&digits=6&period=30'
    );
  });
});
