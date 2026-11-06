/**
 * @fileoverview Who a rate limiter thinks is calling.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-11-06
 *
 * Nothing set `trust proxy`, so behind Railway's edge `req.ip` was the proxy
 * for every request and every caller shared one bucket. The login limiter is
 * five attempts per fifteen minutes: five failures from anyone locked out the
 * whole platform. The obvious "fix" — `trust proxy: true` — is worse, because
 * it trusts the client-written portion of X-Forwarded-For and lets any caller
 * mint a fresh bucket per request.
 */

import express from 'express';
import request from 'supertest';
import { resolveTrustProxyHops, resolveTrustProxy, cloudflareClientIp, normaliseIpForRateLimit } from '../../config/rateLimitKey';

describe('resolveTrustProxyHops', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env['TRUST_PROXY_HOPS'];
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('trusts two hops in production by default — Railway’s edge and its internal proxy', () => {
    // With one, req.ip was the edge server's own address (logged as
    // 46.151.193.242 for a request from 143.105.253.76).
    process.env['NODE_ENV'] = 'production';
    expect(resolveTrustProxyHops()).toBe(2);
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

/**
 * What the app actually receives, replayed through Express. supertest's
 * socket is 127.0.0.1, which stands in for Railway's internal proxy; the
 * right-most X-Forwarded-For entry is the edge server, as in production.
 */
describe('req.ip behind Railway and Cloudflare', () => {
  const ORIGINAL_ENV = process.env;
  const EDGE = '46.151.193.242'; // Railway's Johannesburg edge
  const CLIENT = '143.105.253.76';
  const CLOUDFLARE = '197.234.240.17'; // inside 197.234.240.0/22

  const appWithTrust = () => {
    const app = express();
    app.set('trust proxy', resolveTrustProxy());
    app.use(cloudflareClientIp);
    app.get('/ip', (req, res) => { res.json({ ip: req.ip }); });
    return app;
  };
  const ipFor = async (xff: string, cfConnectingIp?: string): Promise<string> => {
    const req = request(appWithTrust()).get('/ip').set('X-Forwarded-For', xff);
    if (cfConnectingIp !== undefined) req.set('CF-Connecting-IP', cfConnectingIp);
    return (await req).body.ip;
  };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'production' };
    delete process.env['TRUST_PROXY_HOPS'];
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('is the caller, not the edge, for a request straight to Railway', async () => {
    expect(await ipFor(`${CLIENT}, ${EDGE}`)).toBe(CLIENT);
  });

  it('is the caller, not Cloudflare, for a request through Cloudflare', async () => {
    expect(await ipFor(`${CLIENT}, ${CLOUDFLARE}, ${EDGE}`)).toBe(CLIENT);
  });

  it('recognises Cloudflare over IPv6 too', async () => {
    expect(await ipFor(`${CLIENT}, 2a06:98c1:3120::3, ${EDGE}`)).toBe(CLIENT);
  });

  it('ignores an address the caller wrote themselves, straight to Railway', async () => {
    // The edge appends the real peer after whatever the client sent.
    expect(await ipFor(`6.6.6.6, ${CLIENT}, ${EDGE}`)).toBe(CLIENT);
  });

  it('ignores an address the caller wrote themselves, through Cloudflare', async () => {
    expect(await ipFor(`6.6.6.6, ${CLIENT}, ${CLOUDFLARE}, ${EDGE}`)).toBe(CLIENT);
  });

  it('cannot be talked into trusting a forged Cloudflare address in front of the caller', async () => {
    // A caller pretending to come via Cloudflare: their own address is still
    // the first untrusted hop, so the forged entries to its left are never read.
    expect(await ipFor(`6.6.6.6, ${CLOUDFLARE}, ${CLIENT}, ${EDGE}`)).toBe(CLIENT);
  });

  it('takes nothing on trust outside production', async () => {
    process.env['NODE_ENV'] = 'development';
    const ip = await ipFor(`${CLIENT}, ${CLOUDFLARE}, ${EDGE}`);
    expect([CLIENT, CLOUDFLARE, EDGE]).not.toContain(ip);
  });

  // What Railway really sends through Cloudflare (measured 2026-11-06): the
  // edge starts a new chain from its TCP peer, so X-Forwarded-For holds only
  // the Cloudflare edge and Railway's own; the caller is in CF-Connecting-IP.
  it('is the caller Cloudflare reports, when the request came from Cloudflare', async () => {
    expect(await ipFor(`${CLOUDFLARE}, ${EDGE}`, CLIENT)).toBe(CLIENT);
  });

  it('reads CF-Connecting-IP over IPv6 as well', async () => {
    expect(await ipFor(`2a06:98c1:3120::3, ${EDGE}`, '2001:db8::7')).toBe('2001:db8::7');
  });

  it('ignores a CF-Connecting-IP header from a caller who did not come through Cloudflare', async () => {
    expect(await ipFor(`${CLIENT}, ${EDGE}`, '6.6.6.6')).toBe(CLIENT);
  });

  it('keeps the Cloudflare address when CF-Connecting-IP is not an address', async () => {
    expect(await ipFor(`${CLOUDFLARE}, ${EDGE}`, 'not-an-ip')).toBe(CLOUDFLARE);
  });
});
