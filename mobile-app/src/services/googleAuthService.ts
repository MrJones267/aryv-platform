/**
 * Google Authentication Service for React Native
 * Handles Google Sign-In integration
 */

import { GoogleSignin, statusCodes, type SignInResponse } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch } from './authFetch';
import logger from './LoggingService';

const log = logger.createLogger('GoogleAuthService');

export interface GoogleUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  picture?: string;
  idToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  picture?: string;
  role?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  error?: string;
  /** The person closed the account picker: not an error to show them. */
  cancelled?: boolean;
}

class GoogleAuthService {
  private isConfigured = false;

  constructor() {
    this.configureGoogleSignIn();
  }

  /**
   * Configure Google Sign-In
   */
  private configureGoogleSignIn() {
    try {
      GoogleSignin.configure({
        webClientId: process.env.GOOGLE_WEB_CLIENT_ID || '306893979998-g6oetretorc1smcuc9lkiuc3hnjhvtet.apps.googleusercontent.com',
        scopes: ['email', 'profile'],
        // The server verifies the ID token and issues its own session, so no
        // server auth code is needed. Asking for one with
        // forceCodeForRefreshToken put the consent screen up on every sign-in.
      });
      
      this.isConfigured = true;
      log.info('Google Sign-In configured');
    } catch (error) {
      log.error('Google Sign-In configuration failed', error);
      this.isConfigured = false;
    }
  }

  /**
   * Check if Google Play Services are available
   */
  async isGooglePlayServicesAvailable(): Promise<boolean> {
    try {
      await GoogleSignin.hasPlayServices();
      return true;
    } catch (error) {
      log.warn('Google Play Services not available:', error);
      return false;
    }
  }

  /**
   * Sign in with Google
   */
  async signIn(): Promise<AuthResponse> {
    try {
      if (!this.isConfigured) {
        this.configureGoogleSignIn();
        if (!this.isConfigured) {
          throw new Error('Google Sign-In not configured');
        }
      }

      // Check Google Play Services
      const hasPlayServices = await this.isGooglePlayServicesAvailable();
      if (!hasPlayServices) {
        return {
          success: false,
          error: 'Google Play Services not available'
        };
      }

      // Sign in to Google. Since v13 closing the picker returns
      // { type: 'cancelled' } rather than throwing, and was being reported as
      // "Sign in failed".
      const userInfo = await GoogleSignin.signIn();

      if (userInfo.type === 'cancelled') {
        return { success: false, cancelled: true, error: 'Sign in cancelled' };
      }

      if (!userInfo.data?.idToken) {
        throw new Error('No ID token received from Google');
      }

      log.info('🎉 Google Sign-In successful:', userInfo.data.user.email);

      // Verify with backend
      const authResponse = await this.verifyWithBackend(userInfo as unknown as { data: { idToken: string } });

      if (authResponse.success) {
        // Store tokens from backend
        await this.storeTokens(authResponse.tokens!);

        return {
          success: true,
          user: authResponse.user,
          tokens: authResponse.tokens
        };
      } else {
        // Backend verification failed
        if (__DEV__) {
          // In dev mode only, create a local fallback session
          log.warn('Backend verification failed, creating local session (dev only)');
          const googleUser = userInfo.data.user;
          const localUser = {
            id: googleUser.id || `google_${Date.now()}`,
            email: googleUser.email,
            firstName: googleUser.givenName || googleUser.name?.split(' ')[0] || '',
            lastName: googleUser.familyName || googleUser.name?.split(' ').slice(1).join(' ') || '',
            fullName: googleUser.name || googleUser.email,
            picture: googleUser.photo || undefined,
            role: 'passenger',
          };

          const localTokens = {
            accessToken: `dev-google-${Date.now()}`,
            refreshToken: `dev-refresh-google-${Date.now()}`,
            expiresIn: 86400,
          };

          await this.storeTokens(localTokens);
          await AsyncStorage.setItem('@aryv_auth_token', localTokens.accessToken);
          await AsyncStorage.setItem('@aryv_user_data', JSON.stringify(localUser));

          return {
            success: true,
            user: localUser,
            tokens: localTokens,
          };
        }
        // In production, fail properly so user can retry. The server's reason
        // is worth showing: "already registered, sign in with your password"
        // tells the person what to do, where a generic retry message doesn't.
        return {
          success: false,
          error: authResponse.error || 'Google sign-in could not be verified. Please try again.',
        };
      }

    } catch (error: unknown) {
      log.error('Google Sign-In error:', error);

      let errorMessage = 'Sign in failed';
      const errorCode = (error as { code?: string })?.code;

      if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
        return { success: false, cancelled: true, error: 'Sign in cancelled' };
      } else if (errorCode === 'DEVELOPER_ERROR' || errorCode === '10') {
        // Google refused this build of the app: no Android OAuth client for
        // its package name and signing certificate's SHA-1.
        log.error('Google Sign-In DEVELOPER_ERROR: register this build\'s package name and SHA-1 as an Android OAuth client');
        errorMessage = 'Google sign-in is not set up for this version of the app';
      } else if (errorCode === statusCodes.IN_PROGRESS) {
        errorMessage = 'Sign in already in progress';
      } else if (errorCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = 'Google Play Services not available';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Verify Google token with backend
   */
  private async verifyWithBackend(userInfo: { data: { idToken: string } }): Promise<AuthResponse> {
    try {
      const response = await authFetch('/auth/google/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: userInfo.data.idToken,
          deviceInfo: {
            platform: 'mobile',
            userAgent: 'ARYV Mobile App',
            timestamp: new Date().toISOString()
          }
        }),
      });

      const result = await response.json();

      if (result.success) {
        log.info('✅ Backend verification successful');
        return {
          success: true,
          user: result.data.user,
          tokens: {
            accessToken: result.data.accessToken,
            refreshToken: result.data.refreshToken,
            expiresIn: result.data.expiresIn
          }
        };
      } else {
        // The server reports its reason in `error`, not `message`.
        log.error('❌ Backend verification failed:', result.code, result.error);
        return {
          success: false,
          error: result.error || result.message || 'Backend verification failed'
        };
      }

    } catch (error) {
      log.error('Backend verification error:', error);
      return {
        success: false,
        error: 'Network error during verification'
      };
    }
  }

  /**
   * Sign out from Google
   */
  async signOut(): Promise<void> {
    try {
      await GoogleSignin.signOut();
      await this.clearStoredTokens();
      log.info('✅ Google Sign-Out successful');
    } catch (error) {
      log.error('Google Sign-Out error:', error);
    }
  }

  /**
   * Get current Google user (if signed in)
   */
  async getCurrentUser() {
    try {
      return await GoogleSignin.getCurrentUser();
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if user is signed in to Google
   */
  isSignedIn(): boolean {
    // signInSilently() no longer throws when nobody is signed in, so this
    // was always true.
    return GoogleSignin.hasPreviousSignIn();
  }

  /**
   * Store authentication tokens
   */
  private async storeTokens(tokens: { accessToken: string; refreshToken: string; expiresIn: number }) {
    try {
      await AsyncStorage.multiSet([
        ['accessToken', tokens.accessToken],
        ['refreshToken', tokens.refreshToken],
        ['tokenExpiresAt', (Date.now() + tokens.expiresIn * 1000).toString()]
      ]);
    } catch (error) {
      log.error('Token storage error:', error);
    }
  }

  /**
   * Clear stored tokens
   */
  private async clearStoredTokens() {
    try {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'tokenExpiresAt']);
    } catch (error) {
      log.error('Token clearing error:', error);
    }
  }

  /**
   * Get stored access token
   */
  async getStoredAccessToken(): Promise<string | null> {
    try {
      const [token, expiresAt] = await AsyncStorage.multiGet(['accessToken', 'tokenExpiresAt']);
      
      if (!token[1] || !expiresAt[1]) {
        return null;
      }

      // Check if token is expired
      if (Date.now() > parseInt(expiresAt[1])) {
        await this.clearStoredTokens();
        return null;
      }

      return token[1];
    } catch (error) {
      log.error('Token retrieval error:', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<string | null> {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        return null;
      }

      const response = await authFetch('/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const result = await response.json();

      if (result.success) {
        await this.storeTokens({
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken,
          expiresIn: result.data.expiresIn
        });
        
        return result.data.accessToken;
      } else {
        // Refresh failed, clear tokens
        await this.clearStoredTokens();
        return null;
      }
    } catch (error) {
      log.error('Token refresh error:', error);
      await this.clearStoredTokens();
      return null;
    }
  }
}

// Export singleton instance
export const googleAuthService = new GoogleAuthService();
export default googleAuthService;