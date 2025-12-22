/**
 * @fileoverview User management slice for admin panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { userService } from '../../services/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  profileImage?: string;
  isVerified: boolean;
  isActive: boolean;
  isBlocked: boolean;
  blockReason?: string;
  role: 'passenger' | 'driver' | 'both';
  totalRidesAsPassenger: number;
  totalRidesAsDriver: number;
  totalDeliveries: number;
  rating: number;
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
}

interface UserFilters {
  search: string;
  status: 'all' | 'active' | 'inactive' | 'blocked' | 'unverified';
  role: 'all' | 'passenger' | 'driver' | 'both';
  dateFrom?: string;
  dateTo?: string;
}

interface UserState {
  users: User[];
  selectedUser: User | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: UserFilters;
  stats: {
    total: number;
    active: number;
    verified: number;
    blocked: number;
  };
}

const initialState: UserState = {
  users: [],
  selectedUser: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  },
  filters: {
    search: '',
    status: 'all',
    role: 'all',
  },
  stats: {
    total: 0,
    active: 0,
    verified: 0,
    blocked: 0,
  },
};

// Async thunks
export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      role?: string;
    } = {},
    { rejectWithValue }
  ) => {
    try {
      const response = await userService.getUsers(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch users');
    }
  }
);

export const fetchUserById = createAsyncThunk('users/fetchUserById', async (userId: string, { rejectWithValue }) => {
  try {
    const response = await userService.getUserById(userId);
    return response.data.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch user');
  }
});

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ id, data }: { id: string; data: Partial<User> }, { rejectWithValue }) => {
    try {
      const response = await userService.updateUser(id, data);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update user');
    }
  }
);

export const blockUser = createAsyncThunk(
  'users/blockUser',
  async ({ id, reason }: { id: string; reason: string }, { rejectWithValue }) => {
    try {
      await userService.blockUser(id, reason);
      return { id, isBlocked: true, blockReason: reason };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to block user');
    }
  }
);

export const unblockUser = createAsyncThunk('users/unblockUser', async (id: string, { rejectWithValue }) => {
  try {
    await userService.unblockUser(id);
    return { id, isBlocked: false, blockReason: undefined };
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to unblock user');
  }
});

export const verifyUser = createAsyncThunk(
  'users/verifyUser',
  async ({ id, verified }: { id: string; verified: boolean }, { rejectWithValue }) => {
    try {
      const response = await userService.verifyUser(id, verified);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to verify user');
    }
  }
);

export const deleteUser = createAsyncThunk('users/deleteUser', async (id: string, { rejectWithValue }) => {
  try {
    await userService.deleteUser(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to delete user');
  }
});

const userSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },
    setFilters: (state, action: PayloadAction<Partial<UserFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setPagination: (state, action: PayloadAction<{ page?: number; limit?: number }>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    clearSelectedUser: state => {
      state.selectedUser = null;
    },
    updateUserInList: (state, action: PayloadAction<Partial<User> & { id: string }>) => {
      const index = state.users.findIndex(user => user.id === action.payload.id);
      if (index !== -1) {
        state.users[index] = { ...state.users[index], ...action.payload };
      }
    },
  },
  extraReducers: builder => {
    builder
      // Fetch users
      .addCase(fetchUsers.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.data;
        state.pagination = action.payload.pagination;

        // Calculate stats
        state.stats = {
          total: action.payload.pagination.total,
          active: action.payload.data.filter((u: User) => u.isActive).length,
          verified: action.payload.data.filter((u: User) => u.isVerified).length,
          blocked: action.payload.data.filter((u: User) => u.isBlocked).length,
        };
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch user by ID
      .addCase(fetchUserById.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedUser = action.payload;
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Update user
      .addCase(updateUser.fulfilled, (state, action) => {
        const index = state.users.findIndex(user => user.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.selectedUser?.id === action.payload.id) {
          state.selectedUser = action.payload;
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      // Block user
      .addCase(blockUser.fulfilled, (state, action) => {
        const { id, isBlocked, blockReason } = action.payload;
        const index = state.users.findIndex(user => user.id === id);
        if (index !== -1) {
          state.users[index].isBlocked = isBlocked;
          state.users[index].blockReason = blockReason;
        }
        if (state.selectedUser?.id === id) {
          state.selectedUser.isBlocked = isBlocked;
          state.selectedUser.blockReason = blockReason;
        }
      })
      .addCase(blockUser.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      // Unblock user
      .addCase(unblockUser.fulfilled, (state, action) => {
        const { id, isBlocked, blockReason } = action.payload;
        const index = state.users.findIndex(user => user.id === id);
        if (index !== -1) {
          state.users[index].isBlocked = isBlocked;
          state.users[index].blockReason = blockReason;
        }
        if (state.selectedUser?.id === id) {
          state.selectedUser.isBlocked = isBlocked;
          state.selectedUser.blockReason = blockReason;
        }
      })
      .addCase(unblockUser.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      // Verify user
      .addCase(verifyUser.fulfilled, (state, action) => {
        const index = state.users.findIndex(user => user.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.selectedUser?.id === action.payload.id) {
          state.selectedUser = action.payload;
        }
      })
      .addCase(verifyUser.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      // Delete user
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.users = state.users.filter(user => user.id !== action.payload);
        if (state.selectedUser?.id === action.payload) {
          state.selectedUser = null;
        }
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setFilters, setPagination, clearSelectedUser, updateUserInList } = userSlice.actions;

export default userSlice.reducer;

// Selectors
export const selectUsers = (state: { users: UserState }) => state.users.users;
export const selectSelectedUser = (state: { users: UserState }) => state.users.selectedUser;
export const selectUsersLoading = (state: { users: UserState }) => state.users.loading;
export const selectUsersError = (state: { users: UserState }) => state.users.error;
export const selectUsersPagination = (state: { users: UserState }) => state.users.pagination;
export const selectUsersFilters = (state: { users: UserState }) => state.users.filters;
export const selectUsersStats = (state: { users: UserState }) => state.users.stats;
