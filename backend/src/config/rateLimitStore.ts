/**
 * @fileoverview Shared Redis-backed store factory for express-rate-limit
 * @author Oabona-Majoko
 * @created 2026-05-18
 * @lastModified 2026-05-18
 */

import { RedisStore } from 'rate-limit-redis';
import { redisClient } from './redis';

/**
 * Returns a RedisStore for the given limiter prefix.
 * When Redis is unavailable the sendCommand fallback returns a "first-hit" response
 * so requests are allowed through — graceful degradation to no rate limiting.
 */
export function makeStore(prefix: string): RedisStore {
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args: string[]) => redisClient.sendCommand(args) as Promise<any>,
  });
}
