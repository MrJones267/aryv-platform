/**
 * @fileoverview Authentication state slice
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../../services/api/authApi';
import AuthService from '../../services/AuthService';

// Types
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  error: string | null;
  loginAttempts: number;
  lastLoginAttempt: number | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  role?: 'passenger' | 'driver';
  dateOfBirth?: Date;
}

export interface AuthResponse {
  success: boolean;
  user: any;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface GoogleLoginData {
  user: any;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

// Initial state
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  error: null,
  loginAttempts: 0,
  lastLoginAttempt: null,
};

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      
      if (response.success && response.data) {
        // Store tokens in AsyncStorage
        await AsyncStorage.setItem('accessToken', response.data.accessToken);
        await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
        
        return response;
      } else {
        return rejectWithValue(response.error || 'Login failed');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (userData: RegisterData, { rejectWithValue }) => {
    try {
      const response = await authApi.register(userData);
      
      if (response.success && response.data) {
        // Store tokens in AsyncStorage
        await AsyncStorage.setItem('accessToken', response.data.accessToken);
        await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
        
        return response;
      } else {
        return rejectWithValue(response.error || 'Registration failed');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const refreshTokens = createAsyncThunk(
  'auth/refreshTokens',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const { refreshToken } = state.auth;
      
      if (!refreshToken) {
        return rejectWithValue('No refresh token available');
      }
      
      const response = await authApi.refreshToken(refreshToken);
      
      if (response.success && response.data) {
        // Store new tokens
        await AsyncStorage.setItem('accessToken', response.data.accessToken);
        await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
        
        return response;
      } else {
        return rejectWithValue(response.error || 'Token refresh failed');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const { accessToken } = state.auth;
      
      if (accessToken) {
        await authApi.logout();
      }
      
      // Clear stored tokens
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      
      return true;
    } catch (error: any) {
      // Even if logout API fails, clear local storage
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      return rejectWithValue(error.message || 'Logout error');
    }
  }
);

export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async (googleData: GoogleLoginData, { rejectWithValue }) => {
    try {
      console.log('🔐 Redux: Processing Google login...');
      
      const result = await AuthService.loginWithGoogle();
      
      if (result.success && result.data) {
        console.log('✅ Redux: Google login successful');
        
        // Store tokens in AsyncStorage
        await AsyncStorage.setItem('accessToken', result.data.token);
        await AsyncStorage.setItem('refreshToken', result.data.refreshToken);
        
        return {
          success: true,
          data: {
            accessToken: result.data.token,
            refreshToken: result.data.refreshToken,
            expiresIn: 3600, // Default to 1 hour
            user: result.data.user
          }
        };
      } else {
        return rejectWithValue(result.error || 'Google authentication failed');
      }
    } catch (error: any) {
      console.error('❌ Redux: Google login error:', error);
      return rejectWithValue(error.message || 'Google authentication error');
    }
  }
);

export const initializeAuth = createAsyncThunk(
  'auth/initializeAuth',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const tokens = await AsyncStorage.multiGet(['accessToken', 'refreshToken']);
      const accessToken = tokens[0][1];
      const refreshToken = tokens[1][1];
      
      if (accessToken && refreshToken) {
        // Verify token is still valid
        try {
          const response = await authApi.verifyToken();
          if (response.success && response.data) {
            return {
              accessToken,
              refreshToken,
              user: response.data.user,
              expiresIn: 3600, // Default to 1 hour
            };
          } else {
            // Token invalid, try to refresh
            return dispatch(refreshTokens()).unwrap();
          }
        } catch {
          // If verification fails, try refresh
          return dispatch(refreshTokens()).unwrap();
        }
      }
      
      return rejectWithValue('No stored tokens');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Auth initialization failed');
    }
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setTokens: (state, action: PayloadAction<{ accessToken: string; refreshToken: string; expiresIn: number }>) => {
      const { accessToken, refreshToken, expiresIn } = action.payload;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.expiresAt = Date.now() + (expiresIn * 1000);
      state.isAuthenticated = true;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.accessToken = null;
      state.refreshToken = null;
      state.expiresAt = null;
      state.error = null;
      state.loginAttempts = 0;
      state.lastLoginAttempt = null;
    },
    incrementLoginAttempts: (state) => {
      state.loginAttempts += 1;
      state.lastLoginAttempt = Date.now();
    },
    resetLoginAttempts: (state) => {
      state.loginAttempts = 0;
      state.lastLoginAttempt = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        if (action.payload.data) {
          const { accessToken, refreshToken, expiresIn } = action.payload.data;
          state.isLoading = false;
          state.isAuthenticated = true;
          state.accessToken = accessToken;
          state.refreshToken = refreshToken;
          state.expiresAt = Date.now() + (expiresIn * 1000);
          state.error = null;
          state.loginAttempts = 0;
          state.lastLoginAttempt = null;
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.loginAttempts += 1;
        state.lastLoginAttempt = Date.now();
      })
      
      // Register cases
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        if (action.payload.data) {
          const { accessToken, refreshToken, expiresIn } = action.payload.data;
          state.isLoading = false;
          state.isAuthenticated = true;
          state.accessToken = accessToken;
          state.refreshToken = refreshToken;
          state.expiresAt = Date.now() + (expiresIn * 1000);
          state.error = null;
        }
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Refresh token cases
      .addCase(refreshTokens.fulfilled, (state, action) => {
        if (action.payload.data) {
          const { accessToken, refreshToken, expiresIn } = action.payload.data;
          state.accessToken = accessToken;
          state.refreshToken = refreshToken;
          state.expiresAt = Date.now() + (expiresIn * 1000);
          state.isAuthenticated = true;
          state.error = null;
        }
      })
      .addCase(refreshTokens.rejected, (state) => {
        state.isAuthenticated = false;
        state.accessToken = null;
        state.refreshToken = null;
        state.expiresAt = null;
        state.error = 'Session expired. Please login again.';
      })
      
      // Logout cases
      .addCase(logoutUser.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.accessToken = null;
        state.refreshToken = null;
        state.expiresAt = null;
        state.error = null;
        state.loginAttempts = 0;
        state.lastLoginAttempt = null;
        state.isLoading = false;
      })
      
      // Google login cases
      .addCase(googleLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(googleLogin.fulfilled, (state, action) => {
        if (action.payload.data) {
          const { accessToken, refreshToken, expiresIn } = action.payload.data;
          state.isLoading = false;
          state.isAuthenticated = true;
          state.accessToken = accessToken;
          state.refreshToken = refreshToken;
          state.expiresAt = Date.now() + (expiresIn * 1000);
          state.error = null;
          state.loginAttempts = 0;
          state.lastLoginAttempt = null;
          console.log('Auth: Google login successful');
        }
      })
      .addCase(googleLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.loginAttempts += 1;
        state.lastLoginAttempt = Date.now();
      })
      
      // Initialize auth cases
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false; // Always set loading to false
        if (action.payload && typeof action.payload === 'object' && 'accessToken' in action.payload) {
          const { accessToken, refreshToken, expiresIn } = action.payload;
          state.isAuthenticated = true;
          state.accessToken = accessToken;
          state.refreshToken = refreshToken;
          state.expiresAt = Date.now() + (expiresIn * 1000);
          state.error = null;
          console.log('Auth: Successfully restored authentication state');
        } else {
          console.log('Auth: No valid tokens found, user will need to login');
        }
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
      });
  },
});

export const {
  setAuthLoading,
  setTokens,
  clearAuthError,
  logout,
  incrementLoginAttempts,
  resetLoginAttempts,
} = authSlice.actions;

export default authSlice;