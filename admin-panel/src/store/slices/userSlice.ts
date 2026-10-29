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
  /** Empty when the user has no phone number. */
  phoneNumber: string;
  profileImage?: string;
  /** The account's status on the server: active, suspended, ... */
  status: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  /** Email verified, and phone too where there is one. */
  isVerified: boolean;
  isActive: boolean;
  isBlocked: boolean;
  blockReason?: string;
  role: 'passenger' | 'driver' | 'courier' | 'admin';
  totalRidesAsPassenger: number;
  totalRidesAsDriver: number;
  totalDeliveries: number;
  rating: number;
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The API's user (phone, status, isEmailVerified, ...) as the panel's User.
 * The panel was written against a different shape: it read phoneNumber,
 * isBlocked and isVerified, none of which the API sends, and took the list's
 * pagination from the wrong level, so the Users pages could not show real data.
 */
export const fromApiUser = (raw: any, stats?: any): User => ({
  id: raw.id,
  email: raw.email ?? '',
  firstName: raw.firstName ?? '',
  lastName: raw.lastName ?? '',
  phoneNumber: raw.phone ?? '',
  profileImage: raw.profilePicture ?? undefined,
  status: raw.status ?? 'active',
  isEmailVerified: !!raw.isEmailVerified,
  isPhoneVerified: !!raw.isPhoneVerified,
  isVerified: !!raw.isEmailVerified && (!raw.phone || !!raw.isPhoneVerified),
  isActive: raw.status === 'active',
  isBlocked: raw.status === 'suspended',
  role: raw.role,
  totalRidesAsDriver: stats?.rides?.total ?? stats?.totalRides ?? 0,
  totalRidesAsPassenger: stats?.bookings?.total ?? stats?.totalBookings ?? 0,
  totalDeliveries: 0,
  rating: Number(raw.rating ?? 0),
  lastLogin: raw.lastLoginAt ?? '',
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
});

interface UserFilters {
  search: string;
  status: 'all' | 'active' | 'inactive' | 'blocked' | 'unverified';
  role: 'all' | 'passenger' | 'driver' | 'courier';
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
      const { users, pagination } = response.data.data;
      return { users: users.map((u: any) => fromApiUser(u, u.stats)), pagination };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch users');
    }
  }
);

export const fetchUserById = createAsyncThunk('users/fetchUserById', async (userId: string, { rejectWithValue }) => {
  try {
    const response = await userService.getUserById(userId);
    return fromApiUser(response.data.data.user, response.data.data.stats);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch user');
  }
});

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ id, data }: { id: string; data: Partial<User> }, { rejectWithValue }) => {
    try {
      const response = await userService.updateUser(id, data);
      return fromApiUser(response.data.data.user);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to update user');
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
      return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to block user');
    }
  }
);

// Unblocking needs a reason as blocking does; both are kept in the user's
// moderation history.
export const unblockUser = createAsyncThunk(
  'users/unblockUser',
  async ({ id, reason }: { id: string; reason: string }, { rejectWithValue }) => {
    try {
      await userService.unblockUser(id, reason);
      return { id, isBlocked: false, blockReason: undefined };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to unblock user');
    }
  }
);

// Each flag is set explicitly, with a reason kept in the moderation history.
export const verifyUser = createAsyncThunk(
  'users/verifyUser',
  async (
    { id, email, phone, reason }: { id: string; email?: boolean; phone?: boolean; reason: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await userService.verifyUser(id, { email, phone, reason });
      return { id, ...response.data.data } as { id: string; isEmailVerified: boolean; isPhoneVerified: boolean };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update verification');
    }
  }
);

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
        state.users = action.payload.users;
        state.pagination = action.payload.pagination;

        // Counts on this page; total is across all pages
        state.stats = {
          total: action.payload.pagination.total,
          active: action.payload.users.filter(u => u.isActive).length,
          verified: action.payload.users.filter(u => u.isVerified).length,
          blocked: action.payload.users.filter(u => u.isBlocked).length,
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
        // The edit response has no ride counts; keep the ones already loaded.
        const { totalRidesAsDriver, totalRidesAsPassenger, totalDeliveries, rating, lastLogin, ...edited } =
          action.payload;
        const index = state.users.findIndex(user => user.id === edited.id);
        if (index !== -1) {
          state.users[index] = { ...state.users[index], ...edited };
        }
        if (state.selectedUser?.id === edited.id) {
          state.selectedUser = { ...state.selectedUser, ...edited };
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
        const { id, isEmailVerified, isPhoneVerified } = action.payload;
        const apply = (u: User) => {
          u.isEmailVerified = isEmailVerified;
          u.isPhoneVerified = isPhoneVerified;
          u.isVerified = isEmailVerified && (!u.phoneNumber || isPhoneVerified);
        };
        const listed = state.users.find(user => user.id === id);
        if (listed) apply(listed);
        if (state.selectedUser?.id === id) apply(state.selectedUser);
      })
      .addCase(verifyUser.rejected, (state, action) => {
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
