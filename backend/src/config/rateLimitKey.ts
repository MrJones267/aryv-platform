/**
 * @fileoverview How a rate limiter decides who is asking.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
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
 */

import type { Request } from 'express';
import logger from '../utils/logger';

/**
 * Number of reverse proxies between the internet and this process.
 *
 *   1  Railway's edge alone (the default, and correct for a plain Railway
 *      deployment reached directly at its generated or custom domain)
 *   2  a proxying CDN in front of Railway — Cloudflare with the orange cloud
 *      on, for instance
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
  return process.env['NODE_ENV'] === 'production' ? 1 : 0;
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
