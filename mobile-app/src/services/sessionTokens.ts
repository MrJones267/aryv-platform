/**
 * @fileoverview The one place that keeps and refreshes the sign-in tokens.
 * @author Oabona-Majoko
 * @created 2026-11-03
 * @lastModified 2026-11-03
 *
 * The app held three copies of the tokens (the `accessToken`/`refreshToken`
 * keys, the `@aryv_auth_token`/`@aryv_refresh_token` keys, and Redux), and
 * four pieces of code refreshed them, each updating only its own copy. The
 * server rotates refresh tokens and ends the session when a used one comes
 * back, so the first refresh retired the token the other copies held, the
 * next refresh from one of them ended the session, and every request after
 * that went out without a token: "Failed to update profile" a minute after
 * signing in, while the app still looked signed in.
 *
 * Every copy is now written together, a refresh is made once however many
 * callers ask at the same time, and a refused refresh signs the person out
 * rather than leaving them stuck.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { authFetch } from './authFetch';
import logger from './LoggingService';

const log = logger.createLogger('sessionTokens');

/** Every key some part of the app reads a token from. */
const ACCESS_KEYS = ['accessToken', '@aryv_auth_token'];
const REFRESH_KEYS = ['refreshToken', '@aryv_refresh_token'];
const EXPIRES_AT_KEY = 'tokenExpiresAt';

/** Seconds the server says an access token lasts when it does not say (24h). */
const DEFAULT_EXPIRES_IN = 24 * 60 * 60;

/**
 * The store is required lazily: it imports the slices, which import the API
 * services, which import this module.
 */
const getStore = () => (require('../store') as typeof import('../store')).store;

/**
 * Where the session lives: the Android Keystore (iOS Keychain), encrypted,
 * through react-native-keychain. It was kept in AsyncStorage, which is
 * plain text in the app's data folder, readable on a rooted phone.
 *
 * One record holds the pair and its expiry. A cache spares the Keystore a
 * read on every request. Tokens from before this change (AsyncStorage) are
 * moved across on first read and the plain copies removed, so nobody is
 * signed out by the update. If secure storage is unavailable on a device,
 * the session stays in AsyncStorage as before rather than failing sign-in.
 */
const KEYCHAIN_SERVICE = 'com.aryvmobile.session';
const PLAIN_KEYS = [...ACCESS_KEYS, ...REFRESH_KEYS, EXPIRES_AT_KEY];

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
}

let cached: StoredSession | null | undefined;

async function writeSecure(session: StoredSession): Promise<boolean> {
  try {
    await Keychain.setGenericPassword('aryv-session', JSON.stringify(session), {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
    });
    return true;
  } catch (error) {
    log.warn('Secure storage unavailable; keeping the session in app storage', error);
    return false;
  }
}

async function readSecure(): Promise<StoredSession | null> {
  try {
    const stored = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (!stored) return null;
    const parsed = JSON.parse(stored.password) as Partial<StoredSession>;
    return parsed.accessToken
      ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken ?? '', expiresAt: Number(parsed.expiresAt) || 0 }
      : null;
  } catch (error) {
    log.warn('Could not read the session from secure storage', error);
    return null;
  }
}

/** The session, from the cache, the Keystore, or (moved across) AsyncStorage. */
export async function getStoredSession(): Promise<StoredSession | null> {
  if (cached !== undefined) return cached;
  const secure = await readSecure();
  if (secure) {
    cached = secure;
    return secure;
  }
  const plain = Object.fromEntries(await AsyncStorage.multiGet(PLAIN_KEYS)) as Record<string, string | null>;
  const accessToken = ACCESS_KEYS.map((k) => plain[k]).find(Boolean);
  if (!accessToken) {
    cached = null;
    return null;
  }
  const session: StoredSession = {
    accessToken,
    refreshToken: REFRESH_KEYS.map((k) => plain[k]).find(Boolean) ?? '',
    expiresAt: Number(plain[EXPIRES_AT_KEY]) || 0,
  };
  if (await writeSecure(session)) {
    await AsyncStorage.multiRemove(PLAIN_KEYS);
  }
  cached = session;
  return session;
}

/**
 * Store a token pair. For sign-in thunks, whose own reducers put the pair
 * in Redux. Kept under this name: every sign-in path already calls it.
 */
export async function storeTokenKeys(accessToken: string, refreshToken: string, expiresIn = DEFAULT_EXPIRES_IN): Promise<void> {
  const session: StoredSession = { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 };
  cached = session;
  if (await writeSecure(session)) {
    // No plain copy left behind, including ones from before this change.
    await AsyncStorage.multiRemove(PLAIN_KEYS);
    return;
  }
  await AsyncStorage.multiSet([
    ...ACCESS_KEYS.map((key): [string, string] => [key, accessToken]),
    ...REFRESH_KEYS.map((key): [string, string] => [key, refreshToken]),
    [EXPIRES_AT_KEY, String(session.expiresAt)],
  ]);
}

/**
 * Store a token pair and tell Redux, for refreshes and sign-ins that do not
 * dispatch it themselves.
 */
export async function saveTokens(accessToken: string, refreshToken: string, expiresIn = DEFAULT_EXPIRES_IN): Promise<void> {
  await storeTokenKeys(accessToken, refreshToken, expiresIn);
  getStore().dispatch({ type: 'auth/setTokens', payload: { accessToken, refreshToken, expiresIn } });
}

/** Forget the session everywhere it may be stored. */
export async function clearTokens(): Promise<void> {
  cached = null;
  try {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  } catch (error) {
    log.warn('Could not clear the session from secure storage', error);
  }
  await AsyncStorage.multiRemove(PLAIN_KEYS);
}

/** Drop the in-memory copy, so the next read comes from storage (an app restart, in tests). */
export function forgetCachedSession(): void {
  cached = undefined;
}

/** The current access token, if signed in. Every API client reads it here. */
export async function getAccessToken(): Promise<string | null> {
  return (await getStoredSession())?.accessToken ?? null;
}

async function getRefreshToken(): Promise<string | null> {
  return (await getStoredSession())?.refreshToken || null;
}

/** The session is over: clear it and send the person back to sign in. */
async function endSession(reason: string): Promise<void> {
  log.warn('Session ended', { reason });
  await clearTokens();
  const store = getStore();
  store.dispatch({ type: 'auth/logout' });
  store.dispatch({ type: 'user/clearUser' });
}

let inFlight: Promise<string | null> | null = null;

/**
 * Trade the refresh token for a new pair, once.
 *
 * Callers that ask while a refresh is under way share its answer: two
 * refreshes with the same token would be a reuse, which ends the session.
 *
 * @returns the new access token, or null when there is none. A refused
 *          refresh also signs the person out; a network failure does not.
 */
export function refreshSession(): Promise<string | null> {
  if (!inFlight) {
    inFlight = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        await endSession('no refresh token');
        return null;
      }

      let response: Response;
      try {
        response = await authFetch('/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch (error) {
        // Offline: the session may well still be good. Try again later.
        log.warn('Could not reach the server to refresh the session', error);
        return null;
      }

      const body = await response.json().catch(() => null) as
        { success?: boolean; data?: { accessToken?: string; refreshToken?: string; expiresIn?: number }; code?: string } | null;

      if (response.ok && body?.success && body.data?.accessToken && body.data.refreshToken) {
        await saveTokens(body.data.accessToken, body.data.refreshToken, body.data.expiresIn ?? DEFAULT_EXPIRES_IN);
        return body.data.accessToken;
      }

      if (response.status === 400 || response.status === 401 || response.status === 403) {
        await endSession(body?.code ?? `refresh refused (${response.status})`);
      } else {
        log.warn('Session refresh failed', { status: response.status, code: body?.code });
      }
      return null;
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decode base64url to text. React Native 0.72 has no `atob`; calling it
 * threw, which AuthService read as "token invalid" and refreshed on every
 * request.
 */
export function decodeBase64Url(input: string): string {
  const clean = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE64.indexOf(char);
    if (index < 0) throw new Error('Not base64');
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join(''));
}

/** Whether a JWT's `exp` has passed (with a minute's margin). Unreadable counts as expired. */
export function isExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return true;
    const json = JSON.parse(decodeBase64Url(payload));
    return typeof json.exp === 'number' && json.exp * 1000 < Date.now() + 60_000;
  } catch {
    return true;
  }
}

/** A usable access token: the stored one, or a refreshed one if it has expired. */
export async function getValidAccessToken(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return isExpired(token) ? refreshSession() : token;
}
