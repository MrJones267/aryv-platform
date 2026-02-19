/**
 * Google Authentication Service for React Native
 * Handles Google Sign-In integration
 */

import { GoogleSignin, statusCodes, type SignInResponse } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiConfig } from '../config/api';
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
        offlineAccess: true,
        hostedDomain: '',
        forceCodeForRefreshToken: true,
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

      // Sign in to Google
      const userInfo = await GoogleSignin.signIn();
      
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
        // In production, fail properly so user can retry
        return {
          success: false,
          error: 'Google sign-in could not be verified. Please try again.',
        };
      }

    } catch (error: unknown) {
      log.error('Google Sign-In error:', error);

      let errorMessage = 'Sign in failed';
      const errorCode = (error as { code?: string })?.code;

      if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Sign in cancelled';
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
      const apiConfig = getApiConfig();
      const endpoint = `${apiConfig.apiUrl}/auth/google/verify`;

      const response = await fetch(endpoint, {
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
        log.error('❌ Backend verification failed:', result.message);
        return {
          success: false,
          error: result.message || 'Backend verification failed'
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
  async isSignedIn(): Promise<boolean> {
    try {
      await GoogleSignin.signInSilently();
      return true;
    } catch (error) {
      return false;
    }
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

      const apiConfig = getApiConfig();
      const response = await fetch(`${apiConfig.apiUrl}/auth/refresh`, {
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