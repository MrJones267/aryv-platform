/**
 * @fileoverview Tests for signing in with Google
 * @author Oabona-Majoko
 * @created 2026-10-31
 * @lastModified 2026-10-31
 *
 * What went wrong before:
 * - Closing the account picker showed "Sign in failed", because v16 returns
 *   { type: 'cancelled' } where older versions threw.
 * - A successful sign-in ran twice: the Redux step called Google and the
 *   server again instead of keeping the session the button already had.
 * - The server's reason for refusing ("already registered, use your
 *   password") was replaced by a generic retry message.
 */

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authFetch } from '../authFetch';
import { googleAuthService } from '../googleAuthService';
import AuthService from '../AuthService';
import { googleLogin } from '../../store/slices/authSlice';

jest.mock('../authFetch', () => ({ authFetch: jest.fn(), default: jest.fn() }));

const fetchMock = authFetch as jest.Mock;
const reply = (body: unknown) => fetchMock.mockResolvedValueOnce({ json: async () => body });

const googleUser = {
  type: 'success',
  data: {
    idToken: 'google-id-token',
    user: { id: 'g1', email: 'neo@example.com', name: 'Neo Test', givenName: 'Neo', familyName: 'Test', photo: null },
  },
};

describe('signing in with Google', () => {
  const g = global as unknown as { __DEV__: boolean };
  const wasDev = g.__DEV__;

  beforeEach(() => {
    // The dev-only fallback invents a local session when the server says no;
    // these tests are about what a release build does.
    g.__DEV__ = false;
    fetchMock.mockReset();
    jest.spyOn(GoogleSignin, 'hasPlayServices').mockResolvedValue(true);
  });

  afterAll(() => {
    g.__DEV__ = wasDev;
  });

  it('treats closing the account picker as a choice, not a failure', async () => {
    jest.spyOn(GoogleSignin, 'signIn').mockResolvedValue({ type: 'cancelled', data: null } as never);
    const result = await googleAuthService.signIn();
    expect(result).toEqual(expect.objectContaining({ success: false, cancelled: true }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the ID token to the server and keeps the session it returns', async () => {
    jest.spyOn(GoogleSignin, 'signIn').mockResolvedValue(googleUser as never);
    reply({ success: true, data: { user: { id: 'u1', email: 'neo@example.com' }, accessToken: 'a', refreshToken: 'r', expiresIn: 86400 } });
    const result = await googleAuthService.signIn();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).idToken).toBe('google-id-token');
    expect(result).toEqual(expect.objectContaining({ success: true, tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 86400 } }));
  });

  it('passes on the server\'s reason for refusing', async () => {
    jest.spyOn(GoogleSignin, 'signIn').mockResolvedValue(googleUser as never);
    reply({ success: false, code: 'GOOGLE_EMAIL_UNVERIFIED', error: 'This email is already registered. Please sign in with your password.' });
    const result = await googleAuthService.signIn();
    expect(result).toEqual({ success: false, error: 'This email is already registered. Please sign in with your password.' });
  });

  it('says plainly when Google has not been set up for this build', async () => {
    jest.spyOn(GoogleSignin, 'signIn').mockRejectedValue(Object.assign(new Error('DEVELOPER_ERROR'), { code: 'DEVELOPER_ERROR' }));
    const result = await googleAuthService.signIn();
    expect(result).toEqual({ success: false, error: 'Google sign-in is not set up for this version of the app' });
  });

  it('keeps the button\'s session rather than signing in a second time', async () => {
    const signIn = jest.spyOn(GoogleSignin, 'signIn');
    const store = jest.spyOn(AuthService, 'storeGoogleSession').mockResolvedValue();
    const user = { id: 'u1', email: 'neo@example.com' };
    const tokens = { accessToken: 'a', refreshToken: 'r', expiresIn: 86400 };

    const action = await googleLogin({ user, tokens })(jest.fn(), () => ({}), undefined);

    expect(signIn).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store).toHaveBeenCalledWith(user, 'a', 'r');
    expect(action.payload).toEqual({ success: true, data: { accessToken: 'a', refreshToken: 'r', expiresIn: 86400, user } });
  });
});
