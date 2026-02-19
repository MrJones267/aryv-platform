/**
 * @fileoverview User profile state slice
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../services/api/authApi';
import { userApi } from '../../services/api/userApi';
import userManager from '../../services/UserManager';
import {
  User,
  UpdateProfileData,
  UserRole,
  UserVehicle
} from '../../types/user';
import logger from '../../services/LoggingService';

const log = logger.createLogger('UserSlice');

// Utility function to transform user data from API
const transformUserFromApi = (user: any): User => {
  return {
    ...user,
    dateOfBirth: user.dateOfBirth && typeof user.dateOfBirth === 'string' ? new Date(user.dateOfBirth) : user.dateOfBirth,
    memberSince: typeof user.memberSince === 'string' ? new Date(user.memberSince) : user.memberSince,
    createdAt: typeof user.createdAt === 'string' ? new Date(user.createdAt) : user.createdAt,
    updatedAt: typeof user.updatedAt === 'string' ? new Date(user.updatedAt) : user.updatedAt,
    lastLoginAt: user.lastLoginAt && typeof user.lastLoginAt === 'string' ? new Date(user.lastLoginAt) : user.lastLoginAt,
    // Ensure required fields have defaults
    roles: user.roles || [user.primaryRole || 'passenger'],
    primaryRole: user.primaryRole || user.roles?.[0] || 'passenger',
    vehicles: user.vehicles || [],
    rating: user.rating || 0,
    totalRides: user.totalRides || 0,
    totalDeliveries: user.totalDeliveries || 0,
    isEmailVerified: user.isEmailVerified || false,
    isPhoneVerified: user.isPhoneVerified || false,
    isDriverVerified: user.isDriverVerified || false,
    status: user.status || 'active'
  };
};

export interface UserState {
  profile: User | null;
  isLoading: boolean;
  error: string | null;
  updateLoading: boolean;
  updateError: string | null;
  isSyncing: boolean;
  lastSyncAt: Date | null;
}

// Initial state
const initialState: UserState = {
  profile: null,
  isLoading: false,
  error: null,
  updateLoading: false,
  updateError: null,
  isSyncing: false,
  lastSyncAt: null,
};

// Async thunks with UserManager integration
export const fetchUserProfile = createAsyncThunk(
  'user/fetchUserProfile',
  async (_, { rejectWithValue }) => {
    try {
      // Try to get from UserManager first (cached data)
      const cachedUser = userManager.getCurrentUser();
      if (cachedUser) {
        log.info('Using cached user profile');
        return cachedUser;
      }

      // Fetch from API if no cached data
      const response = await userApi.getProfile();
      
      if (response.success && response.data) {
        const user = transformUserFromApi(response.data);
        
        // Update UserManager with fresh data
        await userManager.setUser(user);
        
        return user;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch profile');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'user/updateUserProfile',
  async (updateData: UpdateProfileData, { rejectWithValue }) => {
    try {
      // Use UserManager for coordinated updates
      // Cast to UserManager's UpdateProfileData (excludes 'admin' from primaryRole)
      const updatedUser = await userManager.updateProfile(updateData as import('../../services/UserManager').UpdateProfileData);
      return updatedUser;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update profile');
    }
  }
);

export const syncUserData = createAsyncThunk(
  'user/syncUserData',
  async (_, { rejectWithValue }) => {
    try {
      await userManager.syncFromServer();
      const user = userManager.getCurrentUser();
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Sync failed');
    }
  }
);

export const uploadProfilePicture = createAsyncThunk(
  'user/uploadProfilePicture',
  async (imageUri: string, { rejectWithValue }) => {
    try {
      const response = await authApi.uploadProfilePicture(imageUri);
      
      if (response.success && response.data) {
        return response.data.profilePictureUrl;
      } else {
        return rejectWithValue(response.error || 'Failed to upload profile picture');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const changePassword = createAsyncThunk(
  'user/changePassword',
  async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.changePassword(currentPassword, newPassword);
      
      if (response.success) {
        return true;
      } else {
        return rejectWithValue(response.error || 'Failed to change password');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const deleteAccount = createAsyncThunk(
  'user/deleteAccount',
  async (password: string, { rejectWithValue }) => {
    try {
      const response = await authApi.deleteAccount(password);
      
      if (response.success) {
        return true;
      } else {
        return rejectWithValue(response.error || 'Failed to delete account');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

// User slice
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.profile = action.payload;
      state.error = null;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.profile) {
        state.profile = { ...state.profile, ...action.payload };
      }
    },
    clearUser: (state) => {
      state.profile = null;
      state.error = null;
      state.updateError = null;
    },
    clearUserError: (state) => {
      state.error = null;
      state.updateError = null;
    },
    setUserLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setUpdateLoading: (state, action: PayloadAction<boolean>) => {
      state.updateLoading = action.payload;
    },
    // Vehicle management actions
    addVehicle: (state, action: PayloadAction<UserVehicle>) => {
      if (state.profile) {
        state.profile.vehicles = [...(state.profile.vehicles || []), action.payload];
      }
    },
    updateVehicle: (state, action: PayloadAction<{ vehicleId: string; updates: Partial<UserVehicle> }>) => {
      if (state.profile?.vehicles) {
        const index = state.profile.vehicles.findIndex(v => v.id === action.payload.vehicleId);
        if (index !== -1) {
          state.profile.vehicles[index] = { ...state.profile.vehicles[index], ...action.payload.updates };
        }
      }
    },
    removeVehicle: (state, action: PayloadAction<string>) => {
      if (state.profile?.vehicles) {
        state.profile.vehicles = state.profile.vehicles.filter(v => v.id !== action.payload);
      }
    },
    // Role management actions
    addRole: (state, action: PayloadAction<UserRole>) => {
      if (state.profile && !state.profile.roles.includes(action.payload)) {
        state.profile.roles.push(action.payload);
      }
    },
    removeRole: (state, action: PayloadAction<UserRole>) => {
      if (state.profile) {
        state.profile.roles = state.profile.roles.filter(role => role !== action.payload);
        // Update primary role if removed role was primary
        if (state.profile.primaryRole === action.payload && state.profile.roles.length > 0) {
          state.profile.primaryRole = state.profile.roles[0];
        }
      }
    },
    setPrimaryRole: (state, action: PayloadAction<UserRole>) => {
      if (state.profile && state.profile.roles.includes(action.payload)) {
        state.profile.primaryRole = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch profile cases
      .addCase(fetchUserProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.profile = action.payload ? transformUserFromApi(action.payload) : null;
        state.error = null;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Update profile cases
      .addCase(updateUserProfile.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.updateLoading = false;
        state.profile = action.payload ? transformUserFromApi(action.payload) : null;
        state.updateError = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload as string;
      })
      
      // Upload profile picture cases
      .addCase(uploadProfilePicture.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(uploadProfilePicture.fulfilled, (state, action) => {
        state.updateLoading = false;
        if (state.profile) {
          state.profile.profilePicture = action.payload;
        }
        state.updateError = null;
      })
      .addCase(uploadProfilePicture.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload as string;
      })
      
      // Change password cases
      .addCase(changePassword.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.updateLoading = false;
        state.updateError = null;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload as string;
      })
      
      // Delete account cases
      .addCase(deleteAccount.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(deleteAccount.fulfilled, (state) => {
        state.profile = null;
        state.updateLoading = false;
        state.updateError = null;
      })
      .addCase(deleteAccount.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload as string;
      });
  },
});

export const {
  setUser,
  updateUser,
  clearUser,
  clearUserError,
  setUserLoading,
  setUpdateLoading,
  // Vehicle management actions
  addVehicle,
  updateVehicle,
  removeVehicle,
  // Role management actions
  addRole,
  removeRole,
  setPrimaryRole,
} = userSlice.actions;

export default userSlice;