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
import { getApiConfig } from '../config/api';
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

  async getValidToken(): Promise<string | null> {
    if (!this.token) {
      await this.initializeAuth();
    }

    if (!this.token) {
      return null;
    }

    // Check if token is expired by decoding JWT
    const isValid = await this.validateToken(this.token);
    if (!isValid) {
      // Attempt to refresh token
      const refreshed = await this.refreshAuthToken();
      return refreshed ? this.token : null;
    }

    return this.token;
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
      
      // For real JWT tokens
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        log.info('Invalid JWT format');
        return false;
      }
      
      const tokenPayload = JSON.parse(atob(tokenParts[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Check expiration
      if (tokenPayload.exp && tokenPayload.exp < currentTime) {
        log.info('Token expired');
        return false;
      }
      
      // Check issuer and other claims if needed
      if (tokenPayload.iss && !this.isValidIssuer(tokenPayload.iss)) {
        log.info('Invalid token issuer');
        return false;
      }
      
      // Check user role for courier operations
      if (tokenPayload.role && !this.hasValidRole(tokenPayload.role)) {
        log.info('Invalid user role for courier operations');
        return false;
      }
      
      return true;
    } catch (error) {
      log.error('Error validating token', error);
      return false;
    }
  }

  /**
   * Check if issuer is valid
   */
  private isValidIssuer(issuer: string): boolean {
    const validIssuers = [
      'https://api.aryv-app.com',
      'aryv-auth-service',
      'localhost:3000' // for development
    ];
    return validIssuers.includes(issuer);
  }

  /**
   * Check if user has valid role for operations
   */
  private hasValidRole(role: string): boolean {
    const validRoles = ['passenger', 'driver', 'courier', 'admin'];
    return validRoles.includes(role.toLowerCase());
  }

  private async refreshAuthToken(): Promise<boolean> {
    if (!this.refreshToken) {
      await this.logout();
      return false;
    }

    try {
      const response = await fetch(`${getApiConfig().apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        await this.logout();
        return false;
      }

      const data = await response.json();
      
      if (data.success && data.data.accessToken) {
        await this.setAuthData(data.data.accessToken, this.refreshToken, this.userData);
        return true;
      } else {
        await this.logout();
        return false;
      }
    } catch (error) {
      log.error('Error refreshing token', error);
      await this.logout();
      return false;
    }
  }

  async login(email: string, password: string): Promise<{
    success: boolean;
    data?: { user: User; token: string; refreshToken: string };
    error?: string;
  }> {
    try {
      const response = await fetch(`${getApiConfig().apiUrl}/auth/login`, {
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

  async loginWithGoogle(): Promise<{
    success: boolean;
    data?: { user: User; token: string; refreshToken: string };
    error?: string;
  }> {
    try {
      log.info('🔐 AuthService: Starting Google login...');
      
      const result = await googleAuthService.signIn();
      
      if (result.success && result.user && result.tokens) {
        // Store the authentication data - cast AuthUser to User for compatibility
        const userAsUser = result.user as unknown as User;
        await this.setAuthData(
          result.tokens.accessToken,
          result.tokens.refreshToken,
          userAsUser
        );

        log.info('✅ AuthService: Google login successful');

        return {
          success: true,
          data: {
            user: userAsUser,
            token: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken
          }
        };
      } else {
        log.error('❌ AuthService: Google login failed:', result.error);
        return {
          success: false,
          error: result.error || 'Google authentication failed'
        };
      }
    } catch (error) {
      log.error('❌ AuthService: Google login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google authentication error'
      };
    }
  }

  async register(userData: RegisterData): Promise<{
    success: boolean;
    data?: { user: User; token: string; refreshToken: string };
    error?: string;
  }> {
    try {
      const response = await fetch(`${getApiConfig().apiUrl}/auth/register`, {
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
        AsyncStorage.setItem(AUTH_TOKEN_KEY, token),
        refreshToken ? AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken) : Promise.resolve(),
        user ? AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user)) : Promise.resolve(),
      ]);
    } catch (error) {
      log.error('Error storing auth data:', error);
    }
  }

  async logout(): Promise<void> {
    try {
      log.info('🚪 AuthService: Starting logout...');
      
      // Check if user was signed in with Google
      const isGoogleUser = (this.userData as any)?.authProvider === 'google';
      
      // Sign out from Google if applicable
      if (isGoogleUser) {
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
        await Promise.all([
          AsyncStorage.setItem(AUTH_TOKEN_KEY, accessToken),
          AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
          AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user)),
        ]);
      }
    } catch (error) {
      log.error('AuthService: Error syncing with Redux state:', error);
    }
  }
}

export default new AuthService();