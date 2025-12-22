/**
 * Google Authentication Service for React Native
 * Handles Google Sign-In integration
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiConfig } from '../config/api';

export interface GoogleUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  picture?: string;
  idToken: string;
}

export interface AuthResponse {
  success: boolean;
  user?: any;
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
        offlineAccess: false,
        hostedDomain: '', // Restrict to domain if needed
        forceCodeForRefreshToken: false,
      });
      
      this.isConfigured = true;
      console.log('✅ Google Sign-In configured');
    } catch (error) {
      console.error('❌ Google Sign-In configuration failed:', error);
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
      console.warn('Google Play Services not available:', error);
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

      console.log('🎉 Google Sign-In successful:', userInfo.data.user.email);

      // Verify with backend
      const authResponse = await this.verifyWithBackend(userInfo);
      
      if (authResponse.success) {
        // Store tokens
        await this.storeTokens(authResponse.tokens!);
        
        return {
          success: true,
          user: authResponse.user,
          tokens: authResponse.tokens
        };
      } else {
        // Sign out from Google if backend verification fails
        await this.signOut();
        return authResponse;
      }

    } catch (error: any) {
      console.error('Google Sign-In error:', error);

      let errorMessage = 'Sign in failed';
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Sign in cancelled';
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorMessage = 'Sign in already in progress';
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
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
  private async verifyWithBackend(userInfo: any): Promise<AuthResponse> {
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
        console.log('✅ Backend verification successful');
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
        console.error('❌ Backend verification failed:', result.message);
        return {
          success: false,
          error: result.message || 'Backend verification failed'
        };
      }

    } catch (error) {
      console.error('Backend verification error:', error);
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
      console.log('✅ Google Sign-Out successful');
    } catch (error) {
      console.error('Google Sign-Out error:', error);
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
      console.error('Token storage error:', error);
    }
  }

  /**
   * Clear stored tokens
   */
  private async clearStoredTokens() {
    try {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'tokenExpiresAt']);
    } catch (error) {
      console.error('Token clearing error:', error);
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
      console.error('Token retrieval error:', error);
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
      console.error('Token refresh error:', error);
      await this.clearStoredTokens();
      return null;
    }
  }
}

// Export singleton instance
export const googleAuthService = new GoogleAuthService();
export default googleAuthService;