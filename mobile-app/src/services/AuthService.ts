/**
 * @fileoverview Authentication Service for user management and token handling
 * @author Oabona-Majoko
 * @created 2025-08-31
 * @lastModified 2025-08-31
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { googleAuthService } from './googleAuthService';

const AUTH_TOKEN_KEY = '@aryv_auth_token';
const REFRESH_TOKEN_KEY = '@aryv_refresh_token';
const USER_DATA_KEY = '@aryv_user_data';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profileImage?: string;
  userType: 'user' | 'courier';
  role?: 'passenger' | 'driver' | 'admin' | 'courier';
  status?: 'active' | 'suspended' | 'pending_verification' | 'deactivated';
  profilePicture?: string;
  dateOfBirth?: Date;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  authProvider?: 'email' | 'google';
  googleId?: string;
}

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
      console.error('Error initializing auth:', error);
    }
  }

  async getValidToken(): Promise<string | null> {
    if (!this.token) {
      await this.initializeAuth();
    }

    if (!this.token) {
      return null;
    }

    // Check if token is expired (basic check - in production, decode JWT)
    try {
      // Handle mock tokens that aren't JWT format
      if (this.token.startsWith('mock-')) {
        console.log('AuthService: Using mock token, skipping JWT validation');
        return this.token;
      }
      
      // For real JWT tokens
      const tokenParts = this.token.split('.');
      if (tokenParts.length !== 3) {
        console.log('AuthService: Invalid JWT format, using token as-is');
        return this.token;
      }
      
      const tokenPayload = JSON.parse(atob(tokenParts[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (tokenPayload.exp && tokenPayload.exp < currentTime) {
        // Token expired, try to refresh
        console.log('AuthService: Token expired, refreshing...');
        return await this.refreshAuthToken();
      }
      
      return this.token;
    } catch (error) {
      console.log('AuthService: Error validating token, using as-is:', error);
      return this.token; // Return token as-is if we can't parse it
    }
  }

  private async refreshAuthToken(): Promise<string | null> {
    if (!this.refreshToken) {
      await this.logout();
      return null;
    }

    try {
      const response = await fetch('https://api.aryv-app.com/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        await this.logout();
        return null;
      }

      const data = await response.json();
      
      if (data.success && data.data.accessToken) {
        await this.setAuthData(data.data.accessToken, this.refreshToken, this.userData);
        return data.data.accessToken;
      } else {
        await this.logout();
        return null;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      await this.logout();
      return null;
    }
  }

  async login(email: string, password: string): Promise<{
    success: boolean;
    data?: { user: User; token: string; refreshToken: string };
    error?: string;
  }> {
    try {
      const response = await fetch('https://api.aryv-app.com/api/auth/login', {
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
      console.error('Login error:', error);
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
      console.log('🔐 AuthService: Starting Google login...');
      
      const result = await googleAuthService.signIn();
      
      if (result.success && result.user && result.tokens) {
        // Store the authentication data
        await this.setAuthData(
          result.tokens.accessToken,
          result.tokens.refreshToken,
          result.user
        );
        
        console.log('✅ AuthService: Google login successful');
        
        return {
          success: true,
          data: {
            user: result.user,
            token: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken
          }
        };
      } else {
        console.error('❌ AuthService: Google login failed:', result.error);
        return {
          success: false,
          error: result.error || 'Google authentication failed'
        };
      }
    } catch (error) {
      console.error('❌ AuthService: Google login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google authentication error'
      };
    }
  }

  async register(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
    userType: 'user' | 'courier';
  }): Promise<{
    success: boolean;
    data?: { user: User; token: string; refreshToken: string };
    error?: string;
  }> {
    try {
      const response = await fetch('https://api.aryv-app.com/api/auth/register', {
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
      console.error('Registration error:', error);
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
      console.error('Error storing auth data:', error);
    }
  }

  async logout(): Promise<void> {
    try {
      console.log('🚪 AuthService: Starting logout...');
      
      // Check if user was signed in with Google
      const isGoogleUser = this.userData?.authProvider === 'google';
      
      // Sign out from Google if applicable
      if (isGoogleUser) {
        console.log('🔐 AuthService: Signing out from Google...');
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
      
      console.log('✅ AuthService: Logout completed');
    } catch (error) {
      console.error('❌ AuthService: Error during logout:', error);
      
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
        console.error('Error clearing auth data:', storageError);
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
    console.log('AuthService: Syncing with Redux state');
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
      console.error('AuthService: Error syncing with Redux state:', error);
    }
  }
}

export default new AuthService();