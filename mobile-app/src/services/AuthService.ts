/**
 * @fileoverview Authentication Service for user management and token handling
 * @author Oabona-Majoko
 * @created 2025-08-31
 * @lastModified 2025-08-31
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { googleAuthService } from './googleAuthService';
import { User, UserSession, LoginCredentials, RegisterData } from '../types/user';
// jwt-decode is optional - token validation is done manually below
import { authFetch } from './authFetch';
import { getValidAccessToken, isExpired, saveTokens } from './sessionTokens';
import logger from './LoggingService';

const log = logger.createLogger('AuthService');

const AUTH_TOKEN_KEY = '@aryv_auth_token';
const REFRESH_TOKEN_KEY = '@aryv_refresh_token';
const USER_DATA_KEY = '@aryv_user_data';

export class AuthService {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private userData: User | null = null;

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      const [token, refreshToken, userData] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(REFRESH_TOKEN_KEY),
        AsyncStorage.getItem(USER_DATA_KEY),
      ]);

      this.token = token;
      this.refreshToken = refreshToken;
      this.userData = userData ? JSON.parse(userData) : null;
    } catch (error) {
      log.error('Error initializing auth', error);
    }
  }

  /**
   * A usable access token, refreshed through the shared session only when it
   * has expired. This used to call validateToken, which rejected every token
   * the server issues (its issuer is 'hitch-api', and `atob` does not exist
   * on React Native 0.72), so each call refreshed, kept the old refresh
   * token, and soon ended the session.
   */
  async getValidToken(): Promise<string | null> {
    const token = await getValidAccessToken();
    this.token = token;
    return token;
  }

  /**
   * Validate JWT token structure, expiration, and claims
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      // In production, reject mock tokens entirely
      if (!__DEV__ && token.startsWith('mock-')) {
        log.info('Mock token rejected in production');
        return false;
      }
      // In dev mode only, allow mock tokens for testing
      if (__DEV__ && token.startsWith('mock-')) {
        log.info('Mock token accepted (dev only)');
        return true;
      }
      
      // A real JWT: only whether it has expired. The issuer and role checks
      // here rejected every token the server issues.
      return token.split('.').length === 3 && !isExpired(token);
    } catch (error) {
      log.error('Error validating token', error);
      return false;
    }
  }


  async login(email: string, password: string): Promise<{
    success: boolean;
    data?: { user: User; token: string; refreshToken: string };
    error?: string;
  }> {
    try {
      const response = await authFetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await this.setAuthData(data.data.accessToken, data.data.refreshToken, data.data.user);
        return { success: true, data: { user: data.data.user, token: data.data.accessToken, refreshToken: data.data.refreshToken } };
      } else {
        return {
          success: false,
          error: data.message || 'Login failed',
        };
      }
    } catch (error) {
      log.error('Login error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /** Keep a session the Google button already obtained from the server. */
  async storeGoogleSession(user: User, accessToken: string, refreshToken: string): Promise<void> {
    await this.setAuthData(accessToken, refreshToken, user);
  }

  async register(userData: RegisterData): Promise<{
    success: boolean;
    data?: { user: User; token: string; refreshToken: string };
    error?: string;
  }> {
    try {
      const response = await authFetch('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await this.setAuthData(data.data.accessToken, data.data.refreshToken, data.data.user);
        return { success: true, data: { user: data.data.user, token: data.data.accessToken, refreshToken: data.data.refreshToken } };
      } else {
        return {
          success: false,
          error: data.message || 'Registration failed',
        };
      }
    } catch (error) {
      log.error('Registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  private async setAuthData(
    token: string,
    refreshToken: string | null,
    user: User | null
  ): Promise<void> {
    this.token = token;
    this.refreshToken = refreshToken;
    this.userData = user;

    try {
      await Promise.all([
        // Every copy of the tokens at once; see sessionTokens.
        refreshToken ? saveTokens(token, refreshToken) : AsyncStorage.setItem(AUTH_TOKEN_KEY, token),
        user ? AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user)) : Promise.resolve(),
      ]);
    } catch (error) {
      log.error('Error storing auth data:', error);
    }
  }

  async logout(): Promise<void> {
    try {
      log.info('🚪 AuthService: Starting logout...');
      
      // Sign out of Google whenever Google remembers an account. This checked
      // userData.authProvider, which the server never sends, so the account
      // stayed remembered and the next "Sign in with Google" could pick it
      // without asking.
      if (googleAuthService.isSignedIn()) {
        log.info('🔐 AuthService: Signing out from Google...');
        await googleAuthService.signOut();
      }
      
      // Clear local auth data
      this.token = null;
      this.refreshToken = null;
      this.userData = null;

      await Promise.all([
        AsyncStorage.removeItem(AUTH_TOKEN_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem(USER_DATA_KEY),
      ]);
      
      log.info('✅ AuthService: Logout completed');
    } catch (error) {
      log.error('❌ AuthService: Error during logout:', error);
      
      // Even if Google signout fails, clear local data
      this.token = null;
      this.refreshToken = null;
      this.userData = null;

      try {
        await Promise.all([
          AsyncStorage.removeItem(AUTH_TOKEN_KEY),
          AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
          AsyncStorage.removeItem(USER_DATA_KEY),
        ]);
      } catch (storageError) {
        log.error('Error clearing auth data:', storageError);
      }
    }
  }

  getCurrentUser(): User | null {
    return this.userData;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  async getCurrentToken(): Promise<string | null> {
    return await this.getValidToken();
  }

  // Method to sync AuthService with Redux auth state
  async syncWithReduxState(accessToken: string | null, refreshToken: string | null, user: User | null): Promise<void> {
    log.info('AuthService: Syncing with Redux state');
    this.token = accessToken;
    this.refreshToken = refreshToken;
    this.userData = user;
    
    try {
      if (accessToken && refreshToken && user) {
        // Both sets of keys, so no reader is left with an older pair.
        await AsyncStorage.multiSet([
          ['accessToken', accessToken],
          ['refreshToken', refreshToken],
          [AUTH_TOKEN_KEY, accessToken],
          [REFRESH_TOKEN_KEY, refreshToken],
          [USER_DATA_KEY, JSON.stringify(user)],
        ]);
      }
    } catch (error) {
      log.error('AuthService: Error syncing with Redux state:', error);
    }
  }
}

export default new AuthService();