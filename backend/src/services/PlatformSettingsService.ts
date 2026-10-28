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
import { toE164 } from '../utils/phone';

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

/**
 * Who is texted when someone raises an SOS. Set by a super admin; numbers are
 * stored in E.164. ONCALL_PHONE_NUMBERS (comma-separated) is added on top so
 * an alert still reaches someone if the settings store is unreachable at the
 * moment it is raised.
 */
export const MAX_ONCALL_PHONES = 10;

/**
 * Normalises a list of on-call numbers to E.164, or returns null if the list
 * is not an array of at most MAX_ONCALL_PHONES numbers that all normalise.
 */
export const normaliseOnCallPhones = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length > MAX_ONCALL_PHONES) return null;
  const numbers: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    const e164 = toE164(entry);
    if (!e164) return null;
    if (!numbers.includes(e164)) numbers.push(e164);
  }
  return numbers;
};

/** The on-call numbers an admin has saved. */
export async function getStoredOnCallPhones(): Promise<string[]> {
  return normaliseOnCallPhones((await readStoredSettings())['onCallPhones']) ?? [];
}

/** Numbers from ONCALL_PHONE_NUMBERS on the server, which the panel cannot edit. */
export const getServerOnCallPhones = (): string[] =>
  (process.env['ONCALL_PHONE_NUMBERS'] ?? '')
    .split(',')
    .map((n) => toE164(n.trim()))
    .filter((n): n is string => !!n);

/** Everyone an SOS is texted to: the saved numbers plus the server's. */
export async function getOnCallPhones(): Promise<string[]> {
  return Array.from(new Set([...(await getStoredOnCallPhones()), ...getServerOnCallPhones()]));
}

export default {
  SETTINGS_KEY,
  ADMIN_SESSION_HOURS,
  isValidAdminSessionHours,
  readStoredSettings,
  getAdminSessionHours,
  normaliseOnCallPhones,
  getStoredOnCallPhones,
  getServerOnCallPhones,
  getOnCallPhones,
};
