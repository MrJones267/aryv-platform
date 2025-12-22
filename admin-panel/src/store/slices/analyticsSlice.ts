/**
 * @fileoverview Analytics slice for admin panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../../config/api';

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

export interface RevenueData {
  date: string;
  rides: number;
  courier: number;
  total: number;
  commission: number;
}

export interface TopRoute {
  id: string;
  origin: string;
  destination: string;
  count: number;
  avgPrice: number;
  totalRevenue: number;
}

export interface UsageStats {
  platform: {
    activeUsers: number;
    sessionsToday: number;
  };
  rides: {
    todayRides: number;
    avgRideTime: number;
  };
  courier: {
    activeDeliveries: number;
    avgDeliveryTime: number;
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
    // Fetch data from multiple endpoints to build comprehensive dashboard
    const [usersResponse, ridesResponse, packagesResponse, analyticsResponse] = await Promise.all([
      apiClient.get('/api/users'),
      apiClient.get('/api/rides'), 
      apiClient.get('/api/packages'),
      apiClient.get('/api/courier/analytics')
    ]);

    // Process the responses to match DashboardStats interface
    const users = {
      total: usersResponse.data?.length || 0,
      active: usersResponse.data?.filter((u: any) => u.status === 'active').length || 0,
      verified: usersResponse.data?.filter((u: any) => u.verified).length || 0,
    };

    const rides = {
      total: ridesResponse.data?.length || 0,
      completed: ridesResponse.data?.filter((r: any) => r.status === 'confirmed').length || 0,
      cancelled: ridesResponse.data?.filter((r: any) => r.status === 'cancelled').length || 0,
    };

    const revenue = {
      total: analyticsResponse.packages?.totalRevenue || 0,
      thisMonth: analyticsResponse.today?.revenue || 0,
      commission: analyticsResponse.packages?.totalFees || 0,
    };

    const courier = {
      packages: analyticsResponse.packages?.total || 0,
      disputes: 0, // Will be implemented when dispute system is added
      completionRate: analyticsResponse.packages?.completed || 0,
    };

    return { users, rides, revenue, courier };
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to fetch dashboard stats');
  }
});

export const fetchUserGrowth = createAsyncThunk(
  'analytics/fetchUserGrowth',
  async (period: '7d' | '30d' | '90d' | '1y', { rejectWithValue }) => {
    try {
      // For now, return mock data. This would be replaced with actual analytics endpoint
      const mockData = [
        { date: '2024-12-01', totalUsers: 100, newUsers: 15, activeUsers: 85 },
        { date: '2024-12-02', totalUsers: 115, newUsers: 12, activeUsers: 98 },
        { date: '2024-12-03', totalUsers: 127, newUsers: 18, activeUsers: 110 },
        { date: '2024-12-04', totalUsers: 145, newUsers: 22, activeUsers: 125 },
      ];
      return mockData;
    } catch (error: any) {
      return rejectWithValue('Failed to fetch user growth data');
    }
  }
);

export const fetchRevenueReport = createAsyncThunk(
  'analytics/fetchRevenueReport',
  async (
    params: {
      dateFrom: string;
      dateTo: string;
      granularity: 'day' | 'week' | 'month';
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await analyticsService.getRevenueReport(params);
      return response.data.data;
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
    // For now, return mock data. This would be replaced with actual usage stats endpoint
    const mockStats = {
      platform: {
        activeUsers: 142,
        sessionsToday: 289,
      },
      rides: {
        todayRides: 23,
        avgRideTime: 42,
      },
      courier: {
        activeDeliveries: 8,
        avgDeliveryTime: 35,
      },
    };
    return mockStats;
  } catch (error: any) {
    return rejectWithValue('Failed to fetch usage stats');
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
