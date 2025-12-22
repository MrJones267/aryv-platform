/**
 * @fileoverview User profile state slice
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../services/api/authApi';

// Utility function to transform user data from API
const transformUserFromApi = (user: any): User => {
  return {
    ...user,
    dateOfBirth: user.dateOfBirth && typeof user.dateOfBirth === 'string' ? new Date(user.dateOfBirth) : user.dateOfBirth,
    createdAt: typeof user.createdAt === 'string' ? new Date(user.createdAt) : user.createdAt,
    updatedAt: typeof user.updatedAt === 'string' ? new Date(user.updatedAt) : user.updatedAt,
  };
};

// Types
export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'passenger' | 'driver' | 'admin' | 'courier';
  status: 'active' | 'suspended' | 'pending_verification' | 'deactivated';
  profilePicture?: string;
  dateOfBirth?: Date;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserState {
  profile: User | null;
  isLoading: boolean;
  error: string | null;
  updateLoading: boolean;
  updateError: string | null;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
  profilePicture?: string;
  bio?: string;
  interests?: string[];
  vehicleInfo?: any;
  driverLicense?: any;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

// Initial state
const initialState: UserState = {
  profile: null,
  isLoading: false,
  error: null,
  updateLoading: false,
  updateError: null,
};

// Async thunks
export const fetchUserProfile = createAsyncThunk(
  'user/fetchUserProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getProfile();
      
      if (response.success) {
        return response.data;
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
      const response = await authApi.updateProfile(updateData);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to update profile');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
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
} = userSlice.actions;

export default userSlice;