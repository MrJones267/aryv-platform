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
          // Give up after 1 retry to avoid blocking startup
          reconnectStrategy: (retries) => {
            if (retries >= 1) return false;
            return 500;
          },
          connectTimeout: 4000,
        },
      }) as RedisClientType;

      client.on('error', (err) => logger.warn('Redis error', { error: err.message }));
      client.on('connect', () => logger.info('Redis connected'));
      client.on('disconnect', () => { this.connected = false; });

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

  // Used by rate-limit-redis; gracefully returns null when Redis is unavailable
  async sendCommand(args: string[]): Promise<unknown> {
    if (!this.isReady()) {
      // When Redis is down: return a value that lets the request through
      return args[0] === 'EVAL' ? [1, 60000] : null;
    }
    try {
      return await this.client!.sendCommand(args);
    } catch {
      return args[0] === 'EVAL' ? [1, 60000] : null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const redisClient = new RedisClient();
export default redisClient;
