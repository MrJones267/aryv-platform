/**
 * @fileoverview How a rate limiter decides who is asking.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-11-06
 *
 * Two separate ways the previous setup counted the wrong thing.
 *
 * **The proxy.** Express defaults `trust proxy` to false, and nothing in this
 * codebase set it. Behind Railway's edge that makes `req.ip` the proxy's
 * address for every request, so every caller shared one bucket. The global
 * limiter (1000 per 15 minutes) might not have bitten yet, but `loginLimiter`
 * is five attempts per fifteen minutes — shared across the entire platform.
 * Five failed logins from anyone locked out everyone.
 *
 * The fix is not `trust proxy: true`. That trusts the whole X-Forwarded-For
 * chain, including the part the client wrote, so any caller could hand
 * themselves a fresh bucket per request and remove rate limiting entirely.
 * Trust exactly the number of proxies actually in front of this app.
 *
 * **IPv6.** Limiting on a full /128 address is close to no limit at all: a
 * residential IPv6 allocation is typically a /64 or larger, so a client can
 * rotate through billions of addresses without leaving their own subnet.
 * Keys are masked to /64 so the whole allocation shares one bucket.
 *
 * **Railway is two hops, and Cloudflare is a third.** (2026-11-06) The
 * one-hop default made `req.ip` the address of Railway's edge server
 * (46.151.193.241/242 for Johannesburg, 152.233.40.2 for the US edge), not
 * the caller: a tagged request from 143.105.253.76 was logged as
 * 46.151.193.242, both through api.aryv-app.com and straight at the
 * railway.app domain. So every user reaching the same edge shared one
 * bucket again — five logins and ten token refreshes per fifteen minutes
 * for the whole region.
 *
 * The chain the app receives is
 *   direct:      X-Forwarded-For: <client>, <railway edge>         + socket
 *   Cloudflare:  X-Forwarded-For: <client>, <cloudflare>, <edge>   + socket
 * so the app trusts the socket peer and the edge (two hops), and beyond
 * them only addresses inside Cloudflare's published ranges. The first
 * address that is neither is the caller. Anything a client writes into
 * X-Forwarded-For sits to the left of its own real address, so it is never
 * reached.
 */

import type { Request } from 'express';
import proxyaddr from 'proxy-addr';
import logger from '../utils/logger';

/**
 * Cloudflare's published edge ranges (https://www.cloudflare.com/ips/,
 * fetched 2026-11-06). Cloudflare announces changes well in advance; a
 * missing range only makes callers behind it share that edge's bucket.
 */
export const CLOUDFLARE_RANGES: readonly string[] = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
  '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];

const isCloudflare = proxyaddr.compile([...CLOUDFLARE_RANGES]);

/**
 * Number of fixed reverse proxies between the internet and this process,
 * not counting Cloudflare, which is recognised by address instead.
 *
 *   2  Railway: the edge server and the proxy that hands the request to
 *      this container (the default in production)
 *   0  no proxy: local development, or a container reached directly
 *
 * Getting this too low means limits key on a proxy and everyone shares a
 * bucket. Too high means the client's own forged header is trusted. If you
 * change the edge in front of this app, change this with it.
 */
export const resolveTrustProxyHops = (): number => {
  const raw = process.env['TRUST_PROXY_HOPS'];

  if (raw !== undefined && raw !== '') {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 10) {
      return parsed;
    }
    logger.warn('TRUST_PROXY_HOPS is not an integer between 0 and 10 — falling back', { raw });
  }

  // Deployed environments sit behind Railway's edge; local ones do not.
  return process.env['NODE_ENV'] === 'production' ? 2 : 0;
};

/**
 * The `trust proxy` setting: the fixed hops, plus any Cloudflare edge beyond
 * them. Express walks from the socket outwards and stops at the first
 * address this answers false for; that address becomes `req.ip`.
 *
 * Cloudflare is only trusted beyond the fixed hops, and only where the
 * fixed hops exist at all, so a local or directly reached instance never
 * takes a forwarded address on trust.
 */
export const resolveTrustProxy = (): ((addr: string, hop: number) => boolean) => {
  const hops = resolveTrustProxyHops();
  return (addr: string, hop: number): boolean =>
    hop < hops || (hops > 0 && isCloudflare(addr, hop));
};

/**
 * Collapse an address to the unit we are willing to hold responsible: the
 * exact address for IPv4, the /64 allocation for IPv6.
 */
export const normaliseIpForRateLimit = (ip: string | undefined): string => {
  if (!ip) return 'unknown';

  // Express reports IPv4-mapped IPv6 addresses as ::ffff:1.2.3.4.
  const mapped = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  if (!mapped.includes(':')) return mapped; // IPv4

  // IPv6: keep the first four hextets (/64) and drop the interface portion,
  // which the client can vary at will.
  const hextets = mapped.split('%')[0]!.split(':');
  return `${hextets.slice(0, 4).join(':')}::/64`;
};

/**
 * The key every limiter in this app uses. Shared so a new limiter cannot
 * silently fall back to the default and reintroduce either problem above.
 */
export const rateLimitKey = (req: Request): string => normaliseIpForRateLimit(req.ip);
