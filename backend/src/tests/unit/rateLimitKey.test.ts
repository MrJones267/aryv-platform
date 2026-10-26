/**
 * @fileoverview Who a rate limiter thinks is calling.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * Nothing set `trust proxy`, so behind Railway's edge `req.ip` was the proxy
 * for every request and every caller shared one bucket. The login limiter is
 * five attempts per fifteen minutes: five failures from anyone locked out the
 * whole platform. The obvious "fix" — `trust proxy: true` — is worse, because
 * it trusts the client-written portion of X-Forwarded-For and lets any caller
 * mint a fresh bucket per request.
 */

import { resolveTrustProxyHops, normaliseIpForRateLimit } from '../../config/rateLimitKey';

describe('resolveTrustProxyHops', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env['TRUST_PROXY_HOPS'];
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('trusts exactly one hop in production by default — Railway’s edge', () => {
    process.env['NODE_ENV'] = 'production';
    expect(resolveTrustProxyHops()).toBe(1);
  });

  it('trusts nothing outside production', () => {
    process.env['NODE_ENV'] = 'development';
    expect(resolveTrustProxyHops()).toBe(0);
  });

  it('honours an explicit hop count, for a CDN in front of the edge', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['TRUST_PROXY_HOPS'] = '2';
    expect(resolveTrustProxyHops()).toBe(2);
  });

  it('never resolves to a boolean, which would trust the whole chain', () => {
    process.env['NODE_ENV'] = 'production';
    for (const raw of ['true', 'yes', '-1', '99', 'abc', '1.5']) {
      process.env['TRUST_PROXY_HOPS'] = raw;
      const hops = resolveTrustProxyHops();
      expect(typeof hops).toBe('number');
      expect(Number.isInteger(hops)).toBe(true);
      expect(hops).toBeGreaterThanOrEqual(0);
      expect(hops).toBeLessThanOrEqual(10);
    }
  });
});

describe('normaliseIpForRateLimit', () => {
  it('keeps an IPv4 address exactly', () => {
    expect(normaliseIpForRateLimit('203.0.113.7')).toBe('203.0.113.7');
  });

  it('unwraps IPv4-mapped IPv6, so one client is not two buckets', () => {
    expect(normaliseIpForRateLimit('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('collapses IPv6 to the /64 the client cannot escape', () => {
    // A residential IPv6 allocation is a /64 or larger, so limiting on the
    // full /128 lets one client rotate through billions of addresses.
    const a = normaliseIpForRateLimit('2001:db8:abcd:0012:1111:2222:3333:4444');
    const b = normaliseIpForRateLimit('2001:db8:abcd:0012:9999:8888:7777:6666');

    expect(a).toBe(b);
    expect(a).toBe('2001:db8:abcd:0012::/64');
  });

  it('keeps genuinely different IPv6 allocations apart', () => {
    const a = normaliseIpForRateLimit('2001:db8:abcd:0012::1');
    const b = normaliseIpForRateLimit('2001:db8:abcd:0099::1');
    expect(a).not.toBe(b);
  });

  it('handles a missing address without producing a shared empty key', () => {
    expect(normaliseIpForRateLimit(undefined)).toBe('unknown');
  });
});
