/**
 * @fileoverview Platform settings that admins can change, and their limits
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * Settings are stored in Redis under one key, edited through
 * PUT /api/admin/settings. This holds the rules for the ones the backend
 * acts on, so the route that saves them and the code that reads them cannot
 * disagree about what is allowed.
 */

import { redisClient } from '../config/redis';

// Constants
export const SETTINGS_KEY = 'platform:settings';

/**
 * How long an admin stays signed in. It was fixed at 24 hours in code; a
 * super admin now sets it. The default is the minimum, so an unset or
 * unreadable setting gives the shortest session, never a longer one.
 */
export const ADMIN_SESSION_HOURS = { MIN: 1, MAX: 24, DEFAULT: 1 } as const;

export const isValidAdminSessionHours = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= ADMIN_SESSION_HOURS.MIN &&
  value <= ADMIN_SESSION_HOURS.MAX;

/** The stored settings, or {} when none are stored or Redis is unreachable. */
export async function readStoredSettings(): Promise<Record<string, unknown>> {
  const raw = await redisClient.get(SETTINGS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** The admin session length in force, in hours. */
export async function getAdminSessionHours(): Promise<number> {
  const stored = (await readStoredSettings())['adminSessionHours'];
  return isValidAdminSessionHours(stored) ? stored : ADMIN_SESSION_HOURS.DEFAULT;
}

export default { SETTINGS_KEY, ADMIN_SESSION_HOURS, isValidAdminSessionHours, readStoredSettings, getAdminSessionHours };
