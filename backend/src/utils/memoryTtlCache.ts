/**
 * @fileoverview A small in-process key/TTL set, used as a local mirror when
 *               Redis is unreachable.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * This is not a Redis replacement and must never be treated as one: it is
 * per-process, so a second instance cannot see what this one wrote, and it is
 * lost on restart. Its only job is to stop a Redis outage from silently
 * discarding a security decision this very process made moments ago.
 */

// Constants
const DEFAULT_MAX_ENTRIES = 10_000;
const SWEEP_INTERVAL_MS = 60_000;

export class MemoryTtlCache {
  private entries = new Map<string, number>();
  private sweeper: NodeJS.Timeout | null = null;

  constructor(private readonly maxEntries: number = DEFAULT_MAX_ENTRIES) {}

  /** Remember `key` until `ttlSeconds` have passed. */
  set(key: string, ttlSeconds: number): void {
    if (ttlSeconds <= 0) return;

    // Bounded so a flood of writes during an outage cannot exhaust memory.
    // Oldest insertion goes first; entries are short-lived by construction.
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }

    this.entries.set(key, Date.now() + ttlSeconds * 1000);
    this.ensureSweeper();
  }

  has(key: string): boolean {
    const expiresAt = this.entries.get(key);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  /**
   * Drop expired keys periodically so a process that stops reading a key does
   * not hold it forever. Unref'd so it never keeps the process alive.
   */
  private ensureSweeper(): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      const now = Date.now();
      for (const [key, expiresAt] of this.entries) {
        if (expiresAt <= now) this.entries.delete(key);
      }
      if (this.entries.size === 0 && this.sweeper) {
        clearInterval(this.sweeper);
        this.sweeper = null;
      }
    }, SWEEP_INTERVAL_MS);
    this.sweeper.unref?.();
  }

  /** For shutdown and for tests. */
  stop(): void {
    if (this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = null;
    }
  }
}

export default MemoryTtlCache;
