/**
 * @fileoverview Courier service slice for admin panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { courierService, CourierPackageRow, CourierPackageState } from '../../services/api';

export interface CourierPackage {
  id: string;
  senderId: string;
  courierId?: string;
  title: string;
  description: string;
  packageSize: 'small' | 'medium' | 'large' | 'extra_large';
  weight: number;
  fragile: boolean;
  valuable: boolean;
  pickupAddress: string;
  dropoffAddress: string;
  senderPriceOffer: number;
  systemSuggestedPrice: number;
  distance: number;
  status: 'active' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  sender: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  courier?: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
}

export interface DeliveryAgreement {
  id: string;
  packageId: string;
  courierId: string;
  agreedPrice: number;
  platformFee: number;
  escrowAmount: number;
  status: 'pending_pickup' | 'in_transit' | 'completed' | 'disputed' | 'cancelled';
  pickupConfirmedAt?: string;
  deliveryConfirmedAt?: string;
  paymentReleasedAt?: string;
  eventLog: any[];
  createdAt: string;
  updatedAt: string;
  package: CourierPackage;
  courier: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
}

interface CourierState {
  packages: CourierPackageRow[];
  agreements: DeliveryAgreement[];
  loading: boolean;
  error: string | null;
  packagesPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalPackages: number;
    activeDeliveries: number;
    completedDeliveries: number;
    openDisputes: number;
    totalRevenue: number;
    completionRate: number;
  };
}

const initialState: CourierState = {
  packages: [],
  agreements: [],
  loading: false,
  error: null,
  packagesPagination: {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  },
  stats: {
    totalPackages: 0,
    activeDeliveries: 0,
    completedDeliveries: 0,
    openDisputes: 0,
    totalRevenue: 0,
    completionRate: 0,
  },
};

// Async thunks
export const fetchPackages = createAsyncThunk(
  'courier/fetchPackages',
  async (
    params: {
      page?: number;
      limit?: number;
      status?: CourierPackageState;
    } = {},
    { rejectWithValue }
  ) => {
    try {
      const response = await courierService.getPackages(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch packages');
    }
  }
);

export const fetchDeliveryAgreements = createAsyncThunk(
  'courier/fetchAgreements',
  async (
    params: {
      page?: number;
      limit?: number;
      status?: string;
    } = {},
    { rejectWithValue }
  ) => {
    try {
      const response = await courierService.getDeliveryAgreements(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch agreements');
    }
  }
);

export const manualPaymentRelease = createAsyncThunk(
  'courier/manualPaymentRelease',
  async ({ agreementId, reason }: { agreementId: string; reason: string }, { rejectWithValue }) => {
    try {
      await courierService.manualPaymentRelease(agreementId, reason);
      return { agreementId, reason };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to release payment');
    }
  }
);

const courierSlice = createSlice({
  name: 'courier',
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      // Fetch packages
      .addCase(fetchPackages.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPackages.fulfilled, (state, action) => {
        state.loading = false;
        // The server nests both under data. Reading payload.data as the
        // array and payload.pagination as the pagination never matched it.
        state.packages = action.payload.data.packages;
        state.packagesPagination = action.payload.data.pagination;
      })
      .addCase(fetchPackages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch delivery agreements
      .addCase(fetchDeliveryAgreements.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDeliveryAgreements.fulfilled, (state, action) => {
        state.loading = false;
        state.agreements = action.payload.data;

        // Calculate stats
        state.stats.activeDeliveries = action.payload.data.filter(
          (a: DeliveryAgreement) => a.status === 'in_transit'
        ).length;
        state.stats.completedDeliveries = action.payload.data.filter(
          (a: DeliveryAgreement) => a.status === 'completed'
        ).length;
        state.stats.totalRevenue = action.payload.data.reduce(
          (sum: number, a: DeliveryAgreement) => sum + (a.paymentReleasedAt ? a.platformFee : 0),
          0
        );
      })
      .addCase(fetchDeliveryAgreements.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Manual payment release
      .addCase(manualPaymentRelease.fulfilled, (state, action) => {
        const { agreementId } = action.payload;
        const index = state.agreements.findIndex(agreement => agreement.id === agreementId);
        if (index !== -1) {
          state.agreements[index].paymentReleasedAt = new Date().toISOString();
          state.agreements[index].status = 'completed';
        }
      })
      .addCase(manualPaymentRelease.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = courierSlice.actions;
export default courierSlice.reducer;

// Selectors
export const selectPackages = (state: { courier: CourierState }) => state.courier.packages;
export const selectAgreements = (state: { courier: CourierState }) => state.courier.agreements;
export const selectCourierLoading = (state: { courier: CourierState }) => state.courier.loading;
export const selectCourierError = (state: { courier: CourierState }) => state.courier.error;
export const selectCourierStats = (state: { courier: CourierState }) => state.courier.stats;
export const selectPackagesPagination = (state: { courier: CourierState }) => state.courier.packagesPagination;
