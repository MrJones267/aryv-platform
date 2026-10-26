/**
 * @fileoverview Redis client singleton with graceful fallback
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

const REDIS_URL = process.env['REDIS_URL'];
const REDIS_HOST = process.env['REDIS_HOST'] || 'redis';
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] || '6379', 10);
const REDIS_PASSWORD = process.env['REDIS_PASSWORD'];

class RedisClient {
  private client: RedisClientType | null = null;
  private connected = false;
  // Tracks whether we have ever successfully connected. Controls the
  // reconnect strategy: fail fast before the first connect (so startup is
  // never blocked when Redis is absent), then retry resiliently afterwards.
  private everConnected = false;

  private isReady(): boolean {
    return this.client !== null && this.connected;
  }

  async connect(): Promise<void> {
    try {
      const url = REDIS_URL || `redis://${REDIS_HOST}:${REDIS_PORT}`;
      const client = createClient({
        url,
        ...(REDIS_PASSWORD ? { password: REDIS_PASSWORD } : {}),
        socket: {
          reconnectStrategy: (retries) => {
            // Before the first successful connect, give up quickly so an
            // absent Redis never blocks startup.
            if (!this.everConnected) {
              return retries >= 1 ? false : 500;
            }
            // Once a connection has been established, retry indefinitely with
            // capped exponential backoff so a transient Redis outage (e.g. a
            // Railway restart or private-network blip) self-heals instead of
            // leaving Redis permanently disabled.
            return Math.min(retries * 500, 5000);
          },
          connectTimeout: 4000,
        },
      }) as RedisClientType;

      // node-redis v4 events: 'ready' when able to serve commands, 'end' when
      // the connection is closed for good, 'reconnecting' between drops.
      client.on('error', (err) => logger.warn('Redis error', { error: err.message }));
      client.on('ready', () => {
        this.connected = true;
        this.everConnected = true;
        logger.info('Redis connected');
      });
      client.on('reconnecting', () => { this.connected = false; });
      client.on('end', () => { this.connected = false; });

      // Use a timeout race so startup is never blocked more than 6 seconds
      await Promise.race([
        client.connect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis connect timeout')), 6000)
        ),
      ]);

      this.client = client;
      this.connected = true;
    } catch (error) {
      logger.warn('Redis unavailable — token blacklisting disabled', { error: (error as Error).message });
      this.client = null;
      this.connected = false;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isReady()) return;
    try {
      if (ttlSeconds) {
        await this.client!.set(key, value, { EX: ttlSeconds });
      } else {
        await this.client!.set(key, value);
      }
    } catch (error) {
      logger.warn('Redis set failed', { key, error });
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isReady()) return null;
    try {
      return await this.client!.get(key);
    } catch (error) {
      logger.warn('Redis get failed', { key, error });
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isReady()) return;
    try {
      await this.client!.del(key);
    } catch (error) {
      logger.warn('Redis del failed', { key, error });
    }
  }

  // Atomically increment a counter; sets TTL on first increment only
  async increment(key: string, ttlSeconds: number): Promise<number> {
    if (!this.isReady()) return 0;
    try {
      const count = await this.client!.incr(key);
      if (count === 1) await this.client!.expire(key, ttlSeconds);
      return count;
    } catch (error) {
      logger.warn('Redis increment failed', { key, error });
      return 0;
    }
  }

  async ping(): Promise<void> {
    if (!this.isReady()) throw new Error('Redis not connected');
    await this.client!.ping();
  }

  async quit(): Promise<void> {
    if (!this.isReady()) return;
    try {
      await this.client!.quit();
    } catch {
      // ignore errors on shutdown
    }
    this.connected = false;
    this.client = null;
  }

  /**
   * Used by rate-limit-redis.
   *
   * This used to answer `[1, 60000]` — "first hit, allow" — for every EVAL
   * while Redis was unreachable, which silently switched off every rate
   * limiter in the application for the duration of an outage. It no longer
   * invents an answer: an unreachable Redis rejects, and ResilientStore in
   * config/rateLimitStore.ts catches that and counts locally instead.
   *
   * SCRIPT LOAD is the one exception. rate-limit-redis calls it while
   * initialising and only wants a SHA-shaped string back; letting that reject
   * produced an unhandled rejection at startup. A placeholder SHA is safe
   * because the EVALSHA that would use it rejects anyway.
   */
  async sendCommand(args: string[]): Promise<unknown> {
    const cmd = (args[0] || '').toUpperCase();

    if (!this.isReady()) {
      if (cmd === 'SCRIPT') return '0'.repeat(40);
      throw new Error('Redis is unavailable');
    }

    try {
      return await this.client!.sendCommand(args);
    } catch (error) {
      if (cmd === 'SCRIPT') return '0'.repeat(40);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const redisClient = new RedisClient();
export default redisClient;
