/**
 * @fileoverview Rate-limit storage that degrades to a local limiter rather
 *               than to no limiter.
 * @author Oabona-Majoko
 * @created 2026-05-18
 * @lastModified 2026-08-25
 *
 * The previous version handed `rate-limit-redis` a `sendCommand` that, when
 * Redis was unreachable, returned `[1, 60000]` — a first hit — for every EVAL.
 * Every limiter in the application therefore answered "first request, allow"
 * for every request: the global limiter, the login limiter, the password-reset
 * limiter, all of them, silently, for as long as the outage lasted. The
 * comment in that file described it as graceful degradation, but a rate
 * limiter that always allows is not degraded, it is absent.
 *
 * The replacement keeps counting. Redis remains the shared source of truth
 * across instances; when it cannot be reached, each instance falls back to its
 * own in-memory counter. That is weaker — an attacker spread across N
 * instances gets N times the budget — but it is bounded, whereas "allow
 * everything" is not.
 */

import { RedisStore } from 'rate-limit-redis';
import { MemoryStore } from 'express-rate-limit';
import type { Store, Options, ClientRateLimitInfo, IncrementResponse } from 'express-rate-limit';
import { redisClient } from './redis';
import logger from '../utils/logger';

// Constants
const OUTAGE_LOG_INTERVAL_MS = 60_000;

/**
 * Delegates to Redis while it is reachable and to an in-process MemoryStore
 * while it is not, switching per call rather than at construction so recovery
 * needs no restart.
 */
class ResilientStore implements Store {
  private readonly redis: RedisStore;
  private readonly memory: MemoryStore;
  private lastOutageLog = 0;

  constructor(prefix: string) {
    this.redis = new RedisStore({
      prefix: `rl:${prefix}:`,
      // Errors surface as rejections and are caught per call below, so a
      // Redis failure becomes a fallback rather than an unhandled rejection.
      sendCommand: (...args: string[]) => redisClient.sendCommand(args) as Promise<any>,
    });
    this.memory = new MemoryStore();
  }

  init(options: Options): void {
    this.redis.init?.(options);
    this.memory.init?.(options);
  }

  /**
   * Note the fallback, but at most once a minute per store — an outage would
   * otherwise emit a line per request, which buries the incident it is
   * reporting.
   */
  private noteOutage(prefix: string, error?: unknown): void {
    const now = Date.now();
    if (now - this.lastOutageLog < OUTAGE_LOG_INTERVAL_MS) return;
    this.lastOutageLog = now;
    logger.warn('Rate limiting fell back to this instance only — Redis unreachable', {
      store: prefix,
      ...(error ? { error: (error as Error).message } : {}),
    });
  }

  async increment(key: string): Promise<IncrementResponse> {
    if (redisClient.isConnected()) {
      try {
        return await this.redis.increment(key);
      } catch (error) {
        this.noteOutage('increment', error);
      }
    } else {
      this.noteOutage('increment');
    }
    return this.memory.increment(key);
  }

  async decrement(key: string): Promise<void> {
    if (redisClient.isConnected()) {
      try {
        await this.redis.decrement(key);
        return;
      } catch {
        // fall through to the local store
      }
    }
    await this.memory.decrement(key);
  }

  async resetKey(key: string): Promise<void> {
    if (redisClient.isConnected()) {
      try {
        await this.redis.resetKey(key);
      } catch {
        // best effort
      }
    }
    await this.memory.resetKey(key);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    if (redisClient.isConnected()) {
      try {
        return await this.redis.get?.(key);
      } catch {
        // fall through
      }
    }
    return this.memory.get?.(key);
  }

  async resetAll(): Promise<void> {
    await this.memory.resetAll?.();
  }

  shutdown(): void {
    // RedisStore has no shutdown of its own — the client is closed centrally
    // during graceful shutdown in index.ts.
    this.memory.shutdown?.();
  }
}

/**
 * Returns the store for the given limiter prefix.
 *
 * Named `makeStore` still, so every existing limiter picks the new behaviour
 * up without being touched.
 */
export function makeStore(prefix: string): Store {
  return new ResilientStore(prefix);
}
