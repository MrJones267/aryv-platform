/**
 * @fileoverview Analytics slice for admin panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { analyticsService } from '../../services/api';

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    verified: number;
  };
  rides: {
    total: number;
    completed: number;
    cancelled: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    commission: number;
  };
  /** Every currency that has earned anything. Never summed across currencies. */
  revenueByCurrency: CurrencyRevenue[];
  courier: {
    packages: number;
    disputes: number;
    completionRate: number;
  };
}

export interface UserGrowthData {
  date: string;
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
}

export interface CurrencyRevenue {
  currency: string;
  total: number;
  thisMonth: number;
  lastMonth: number;
}

/** One calendar month of revenue in one currency. */
export interface RevenueData {
  /** First day of the month, YYYY-MM-01. */
  month: string;
  currency: string;
  rides: number;
  courier: number;
  total: number;
}

export interface TopRoute {
  id: string;
  origin: string;
  destination: string;
  count: number;
  avgPrice: number;
  totalRevenue: number;
}

/**
 * Platform usage.
 *
 * Null means the platform does not measure this yet, as opposed to zero, which
 * means it measured and found none. Anything rendering these must show the
 * difference rather than coercing a null to 0.
 */
export interface UsageStats {
  platform: {
    activeUsers: number;
    sessionsToday: number | null;
  };
  rides: {
    todayRides: number;
    avgRideTime: number | null;
    completionRate?: number;
    avgRating?: number | null;
  };
  courier: {
    activeDeliveries: number;
    avgDeliveryTime: number | null;
    successRate?: number;
  };
}

interface AnalyticsState {
  dashboardStats: DashboardStats | null;
  userGrowth: UserGrowthData[];
  revenueData: RevenueData[];
  topRoutes: TopRoute[];
  usageStats: UsageStats | null;
  loading: {
    dashboard: boolean;
    userGrowth: boolean;
    revenue: boolean;
    routes: boolean;
    usage: boolean;
  };
  error: string | null;
  selectedPeriod: '7d' | '30d' | '90d' | '1y';
  selectedGranularity: 'day' | 'week' | 'month';
}

const initialState: AnalyticsState = {
  dashboardStats: null,
  userGrowth: [],
  revenueData: [],
  topRoutes: [],
  usageStats: null,
  loading: {
    dashboard: false,
    userGrowth: false,
    revenue: false,
    routes: false,
    usage: false,
  },
  error: null,
  selectedPeriod: '30d',
  selectedGranularity: 'day',
};

// Async thunks
export const fetchDashboardStats = createAsyncThunk('analytics/fetchDashboardStats', async (_, { rejectWithValue }) => {
  try {
    // This used to fan out to the passenger API (/api/users, /api/rides, ...)
    // through the legacy fetch client in config/api. That client reads the
    // token once at page load, so straight after sign-in it sent none, and the
    // passenger routes reject an admin token anyway. Either way it got a 401,
    // and its handler cleared the session and redirected to /login, so the
    // dashboard signed every admin out within seconds of arriving. The admin
    // API already computes these figures in one call.
    const response = await analyticsService.getDashboardStats();
    const data = response.data.data as any;

    return {
      users: {
        total: data?.users?.total ?? 0,
        active: data?.users?.active ?? 0,
        verified: data?.users?.verified ?? 0,
      },
      rides: {
        total: data?.rides?.total ?? 0,
        completed: data?.rides?.completed ?? 0,
        cancelled: data?.rides?.cancelled ?? 0,
      },
      revenue: {
        total: data?.revenue?.total ?? 0,
        thisMonth: data?.revenue?.thisMonth ?? 0,
        commission: data?.revenue?.commission ?? 0,
      },
      revenueByCurrency: data?.revenueByCurrency ?? [],
      courier: {
        packages: data?.courier?.totalPackages ?? 0,
        disputes: data?.disputes?.open ?? 0,
        completionRate: data?.courier?.successRate ?? 0,
      },
    };
  } catch (error: any) {
    return rejectWithValue(
      error.response?.data?.error || error.response?.data?.message || 'Failed to fetch dashboard stats'
    );
  }
});

export const fetchUserGrowth = createAsyncThunk(
  'analytics/fetchUserGrowth',
  async (period: '7d' | '30d' | '90d' | '1y', { rejectWithValue }) => {
    try {
      // This returned four hardcoded December 2024 rows regardless of the
      // period asked for, so the growth chart showed invented numbers that an
      // admin could not distinguish from real ones. The endpoint behind it
      // exists and buckets real signups by day.
      const response = await analyticsService.getUserGrowth(period);
      return response.data.data ?? [];
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch user growth data'
      );
    }
  }
);

export const fetchRevenueReport = createAsyncThunk(
  'analytics/fetchRevenueReport',
  async (months: number = 6, { rejectWithValue }) => {
    try {
      const response = await analyticsService.getRevenueReport(months);
      return (response.data.data?.monthly ?? []) as RevenueData[];
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch revenue report');
    }
  }
);

export const fetchTopRoutes = createAsyncThunk(
  'analytics/fetchTopRoutes',
  async (limit: number = 10, { rejectWithValue }) => {
    try {
      const response = await analyticsService.getTopRoutes(limit);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch top routes');
    }
  }
);

export const fetchUsageStats = createAsyncThunk('analytics/fetchUsageStats', async (_, { rejectWithValue }) => {
  try {
    // Also hardcoded until now. The server reports real counts, but it does not
    // track sessions or average durations, so those are left null rather than
    // filled with a plausible-looking number — a blank reads as "not measured",
    // an invented 289 reads as fact.
    const response = await analyticsService.getUsageStats();
    const data = response.data.data as any;

    return {
      platform: {
        activeUsers: data?.rides?.total ?? 0,
        sessionsToday: null,
      },
      rides: {
        todayRides: data?.rides?.todayRides ?? 0,
        avgRideTime: null,
        completionRate: data?.rides?.completionRate ?? 0,
        avgRating: data?.rides?.avgRating ?? null,
      },
      courier: {
        activeDeliveries: data?.courier?.activeDeliveries ?? 0,
        avgDeliveryTime: null,
        successRate: data?.courier?.successRate ?? 0,
      },
    };
  } catch (error: any) {
    return rejectWithValue(
      error.response?.data?.message || 'Failed to fetch usage stats'
    );
  }
});

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },
    setSelectedPeriod: (state, action: PayloadAction<'7d' | '30d' | '90d' | '1y'>) => {
      state.selectedPeriod = action.payload;
    },
    setSelectedGranularity: (state, action: PayloadAction<'day' | 'week' | 'month'>) => {
      state.selectedGranularity = action.payload;
    },
    clearData: state => {
      state.userGrowth = [];
      state.revenueData = [];
      state.topRoutes = [];
    },
  },
  extraReducers: builder => {
    builder
      // Dashboard stats
      .addCase(fetchDashboardStats.pending, state => {
        state.loading.dashboard = true;
        state.error = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.loading.dashboard = false;
        state.dashboardStats = action.payload;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.loading.dashboard = false;
        state.error = action.payload as string;
      })

      // User growth
      .addCase(fetchUserGrowth.pending, state => {
        state.loading.userGrowth = true;
        state.error = null;
      })
      .addCase(fetchUserGrowth.fulfilled, (state, action) => {
        state.loading.userGrowth = false;
        state.userGrowth = action.payload;
      })
      .addCase(fetchUserGrowth.rejected, (state, action) => {
        state.loading.userGrowth = false;
        state.error = action.payload as string;
      })

      // Revenue report
      .addCase(fetchRevenueReport.pending, state => {
        state.loading.revenue = true;
        state.error = null;
      })
      .addCase(fetchRevenueReport.fulfilled, (state, action) => {
        state.loading.revenue = false;
        state.revenueData = action.payload;
      })
      .addCase(fetchRevenueReport.rejected, (state, action) => {
        state.loading.revenue = false;
        state.error = action.payload as string;
      })

      // Top routes
      .addCase(fetchTopRoutes.pending, state => {
        state.loading.routes = true;
        state.error = null;
      })
      .addCase(fetchTopRoutes.fulfilled, (state, action) => {
        state.loading.routes = false;
        state.topRoutes = action.payload;
      })
      .addCase(fetchTopRoutes.rejected, (state, action) => {
        state.loading.routes = false;
        state.error = action.payload as string;
      })

      // Usage stats
      .addCase(fetchUsageStats.pending, state => {
        state.loading.usage = true;
        state.error = null;
      })
      .addCase(fetchUsageStats.fulfilled, (state, action) => {
        state.loading.usage = false;
        state.usageStats = action.payload;
      })
      .addCase(fetchUsageStats.rejected, (state, action) => {
        state.loading.usage = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setSelectedPeriod, setSelectedGranularity, clearData } = analyticsSlice.actions;

export default analyticsSlice.reducer;

// Selectors
export const selectDashboardStats = (state: { analytics: AnalyticsState }) => state.analytics.dashboardStats;
export const selectUserGrowth = (state: { analytics: AnalyticsState }) => state.analytics.userGrowth;
export const selectRevenueData = (state: { analytics: AnalyticsState }) => state.analytics.revenueData;
export const selectTopRoutes = (state: { analytics: AnalyticsState }) => state.analytics.topRoutes;
export const selectUsageStats = (state: { analytics: AnalyticsState }) => state.analytics.usageStats;
export const selectAnalyticsLoading = (state: { analytics: AnalyticsState }) => state.analytics.loading;
export const selectAnalyticsError = (state: { analytics: AnalyticsState }) => state.analytics.error;
export const selectSelectedPeriod = (state: { analytics: AnalyticsState }) => state.analytics.selectedPeriod;
export const selectSelectedGranularity = (state: { analytics: AnalyticsState }) => state.analytics.selectedGranularity;
