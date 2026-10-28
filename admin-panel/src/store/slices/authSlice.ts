/**
 * @fileoverview Authentication slice for admin panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { adminApi } from '../../services/api';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'admin' | 'moderator';
  permissions: string[];
  isActive: boolean;
  lastLogin: string;
  createdAt: string;
}

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('admin_token'),
  isAuthenticated: false,
  loading: false,
  error: null,
};

// The admin API wraps every payload as { success, data: {...} } and reports
// failures in `error`, not `message`. Reading one level too high stored the
// string "undefined" as the token, so the first dashboard request 401'd and
// the interceptor bounced every sign-in back to /login within seconds.
const errorMessage = (error: any, fallback: string): string =>
  error.response?.data?.error || error.response?.data?.message || fallback;

/**
 * What loginAdmin rejects with when the password was right and the account
 * needs its authenticator code: a prompt for the next step, not an error.
 */
export const TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED';

// Async thunks
export const loginAdmin = createAsyncThunk(
  'auth/loginAdmin',
  async (credentials: { email: string; password: string; code?: string }, { rejectWithValue }) => {
    try {
      const response = await adminApi.post('/auth/login', credentials);
      const user = response.data?.data?.user;
      const token = response.data?.data?.tokens?.accessToken;

      if (!user || !token) {
        return rejectWithValue('Login failed: unexpected response from server');
      }

      localStorage.setItem('admin_token', token);
      return { user, token };
    } catch (error: any) {
      if (error.response?.data?.code === TWO_FACTOR_REQUIRED) {
        return rejectWithValue(TWO_FACTOR_REQUIRED);
      }
      return rejectWithValue(errorMessage(error, 'Login failed'));
    }
  }
);

export const verifyToken = createAsyncThunk('auth/verifyToken', async (_, { rejectWithValue }) => {
  try {
    const response = await adminApi.get('/auth/verify');
    return response.data.data.user;
  } catch (error: any) {
    localStorage.removeItem('admin_token');
    return rejectWithValue(errorMessage(error, 'Token verification failed'));
  }
});

export const logoutAdmin = createAsyncThunk('auth/logoutAdmin', async (_, { rejectWithValue }) => {
  try {
    await adminApi.post('/auth/logout');
    localStorage.removeItem('admin_token');
    return null;
  } catch (error: any) {
    localStorage.removeItem('admin_token');
    return rejectWithValue(errorMessage(error, 'Logout failed'));
  }
});

export const updateAdminProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData: Partial<AdminUser>, { rejectWithValue }) => {
    try {
      const response = await adminApi.put('/auth/profile', profileData);
      return response.data.data.user;
    } catch (error: any) {
      return rejectWithValue(errorMessage(error, 'Profile update failed'));
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },
    setCredentials: (state, action: PayloadAction<{ user: AdminUser; token: string }>) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
      localStorage.setItem('admin_token', token);
    },
    clearCredentials: state => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('admin_token');
    },
  },
  extraReducers: builder => {
    builder
      // Login
      .addCase(loginAdmin.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginAdmin.rejected, (state, action) => {
        state.loading = false;
        // The code prompt is the next step, not a failure to show.
        state.error = action.payload === TWO_FACTOR_REQUIRED ? null : (action.payload as string);
        state.isAuthenticated = false;
      })

      // Verify token
      .addCase(verifyToken.pending, state => {
        state.loading = true;
      })
      .addCase(verifyToken.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(verifyToken.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = action.payload as string;
      })

      // Logout
      .addCase(logoutAdmin.pending, state => {
        state.loading = true;
      })
      .addCase(logoutAdmin.fulfilled, state => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logoutAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Update profile
      .addCase(updateAdminProfile.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateAdminProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(updateAdminProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectAdminUser = (state: { auth: AuthState }) => state.auth.user;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.loading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
