/**
 * @fileoverview The shared sign-in tokens and their refresh
 * @author Oabona-Majoko
 * @created 2026-11-03
 * @lastModified 2026-11-03
 *
 * Three copies of the tokens were refreshed by four pieces of code, each
 * updating only its own. The server rotates refresh tokens and ends the
 * session when a used one comes back, so a minute after signing in every
 * request went out without a token ("Failed to update profile").
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const mockDispatch = jest.fn();
jest.mock('../../store', () => ({ store: { dispatch: (action: unknown) => mockDispatch(action) } }));

const mockAuthFetch = jest.fn();
jest.mock('../authFetch', () => ({ authFetch: (...args: unknown[]) => mockAuthFetch(...args) }));

import {
  saveTokens,
  refreshSession,
  getValidAccessToken,
  isExpired,
  decodeBase64Url,
} from '../sessionTokens';

/** A JWT whose payload carries `exp`; the signature is not checked here. */
const jwt = (expSecondsFromNow: number): string => {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ userId: 'u1', iss: 'hitch-api', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`;
};

const ok = (data: object) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
const refused = (status: number, code: string) => ({ ok: false, status, json: async () => ({ success: false, code }) });

const stored = async () => Object.fromEntries(
  await AsyncStorage.multiGet(['accessToken', '@aryv_auth_token', 'refreshToken', '@aryv_refresh_token']),
);

describe('sessionTokens', () => {
  beforeEach(async () => {
    jest.useRealTimers();
    await AsyncStorage.clear();
    mockDispatch.mockClear();
    mockAuthFetch.mockReset();
  });

  it('saves a pair to every key the app reads, and to Redux', async () => {
    await saveTokens('access-1', 'refresh-1', 3600);
    expect(await stored()).toEqual({
      accessToken: 'access-1', '@aryv_auth_token': 'access-1',
      refreshToken: 'refresh-1', '@aryv_refresh_token': 'refresh-1',
    });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'auth/setTokens', payload: { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 3600 } });
  });

  it('refreshes once for callers who ask together, and saves the new pair everywhere', async () => {
    await saveTokens('access-1', 'refresh-1');
    mockAuthFetch.mockResolvedValue(ok({ accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 3600 }));

    const answers = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(answers).toEqual(['access-2', 'access-2', 'access-2']);
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockAuthFetch.mock.calls[0][1].body)).toEqual({ refreshToken: 'refresh-1' });
    expect(await stored()).toEqual({
      accessToken: 'access-2', '@aryv_auth_token': 'access-2',
      refreshToken: 'refresh-2', '@aryv_refresh_token': 'refresh-2',
    });
  });

  it('uses the rotated refresh token next time, not the one it replaced', async () => {
    await saveTokens('access-1', 'refresh-1');
    mockAuthFetch
      .mockResolvedValueOnce(ok({ accessToken: 'access-2', refreshToken: 'refresh-2' }))
      .mockResolvedValueOnce(ok({ accessToken: 'access-3', refreshToken: 'refresh-3' }));

    await refreshSession();
    await refreshSession();

    expect(JSON.parse(mockAuthFetch.mock.calls[1][1].body)).toEqual({ refreshToken: 'refresh-2' });
  });

  it('signs the person out when the server refuses the refresh, instead of leaving them stuck', async () => {
    await saveTokens('access-1', 'refresh-1');
    mockDispatch.mockClear();
    mockAuthFetch.mockResolvedValue(refused(401, 'REFRESH_TOKEN_REUSE'));

    expect(await refreshSession()).toBeNull();
    expect(await stored()).toEqual({
      accessToken: null, '@aryv_auth_token': null, refreshToken: null, '@aryv_refresh_token': null,
    });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'auth/logout' });
  });

  it('keeps the session when the phone is offline', async () => {
    await saveTokens('access-1', 'refresh-1');
    mockDispatch.mockClear();
    mockAuthFetch.mockRejectedValue(new Error('Network request failed'));

    expect(await refreshSession()).toBeNull();
    expect((await stored()).refreshToken).toBe('refresh-1');
    expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'auth/logout' });
  });

  it('uses a token that has not expired without refreshing it', async () => {
    const token = jwt(3600);
    await saveTokens(token, 'refresh-1');

    expect(await getValidAccessToken()).toBe(token);
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('refreshes a token that has expired', async () => {
    await saveTokens(jwt(-10), 'refresh-1');
    mockAuthFetch.mockResolvedValue(ok({ accessToken: 'access-2', refreshToken: 'refresh-2' }));

    expect(await getValidAccessToken()).toBe('access-2');
  });

  it("reads the server's tokens without atob, which React Native 0.72 lacks", () => {
    expect(decodeBase64Url(Buffer.from('{"iss":"hitch-api","name":"Mpho ✓"}').toString('base64url')))
      .toBe('{"iss":"hitch-api","name":"Mpho ✓"}');
    expect(isExpired(jwt(3600))).toBe(false);
    expect(isExpired(jwt(-10))).toBe(true);
    expect(isExpired('not-a-jwt')).toBe(true);
  });
});
