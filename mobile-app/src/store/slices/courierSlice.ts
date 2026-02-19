/**
 * @fileoverview Courier state slice for delivery management
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Types
export interface DeliveryRequest {
  id: string;
  packageId: string;
  senderId: string;
  senderName: string;

  // Package info
  description: string;
  weight: number;
  isFragile: boolean;

  // Locations
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;

  // Distance and pricing
  distance: number;
  estimatedDuration: number;
  price: number;
  courierEarnings: number;
  currency: string;

  // Status
  status: 'available' | 'accepted' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}

export interface ActiveDelivery {
  id: string;
  packageId: string;
  trackingCode: string;

  // Sender info
  senderId: string;
  senderName: string;
  senderPhone?: string;

  // Recipient info
  recipientName?: string;
  recipientPhone?: string;

  // Package details
  description: string;
  weight: number;
  isFragile: boolean;
  requiresSignature: boolean;

  // Locations
  pickupLocation: {
    address: string;
    latitude: number;
    longitude: number;
  };
  deliveryLocation: {
    address: string;
    latitude: number;
    longitude: number;
  };

  // Pricing
  price: number;
  courierEarnings: number;
  currency: string;

  // Status
  status: 'accepted' | 'en_route_pickup' | 'at_pickup' | 'picked_up' | 'en_route_delivery' | 'at_delivery' | 'delivered';

  // Timestamps
  acceptedAt: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  estimatedDelivery?: Date;

  // Additional
  notes?: string;
  proofOfDelivery?: string;
}

export interface CourierStats {
  totalDeliveries: number;
  completedToday: number;
  totalEarnings: number;
  todayEarnings: number;
  rating: number;
  onTimeRate: number;
}

export interface CourierState {
  isOnline: boolean;
  availableRequests: DeliveryRequest[];
  activeDelivery: ActiveDelivery | null;
  deliveryHistory: ActiveDelivery[];
  stats: CourierStats;
  isLoading: boolean;
  error: string | null;
}

// Initial state
const initialState: CourierState = {
  isOnline: false,
  availableRequests: [],
  activeDelivery: null,
  deliveryHistory: [],
  stats: {
    totalDeliveries: 0,
    completedToday: 0,
    totalEarnings: 0,
    todayEarnings: 0,
    rating: 5.0,
    onTimeRate: 100,
  },
  isLoading: false,
  error: null,
};

// Courier slice
const courierSlice = createSlice({
  name: 'courier',
  initialState,
  reducers: {
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setAvailableRequests: (state, action: PayloadAction<DeliveryRequest[]>) => {
      state.availableRequests = action.payload;
    },
    addDeliveryRequest: (state, action: PayloadAction<DeliveryRequest>) => {
      // Add to beginning of list
      state.availableRequests.unshift(action.payload);
    },
    removeDeliveryRequest: (state, action: PayloadAction<string>) => {
      state.availableRequests = state.availableRequests.filter(r => r.id !== action.payload);
    },
    setActiveDelivery: (state, action: PayloadAction<ActiveDelivery | null>) => {
      state.activeDelivery = action.payload;
    },
    updateActiveDeliveryStatus: (state, action: PayloadAction<ActiveDelivery['status']>) => {
      if (state.activeDelivery) {
        state.activeDelivery.status = action.payload;

        if (action.payload === 'picked_up') {
          state.activeDelivery.pickedUpAt = new Date();
        } else if (action.payload === 'delivered') {
          state.activeDelivery.deliveredAt = new Date();
        }
      }
    },
    completeDelivery: (state) => {
      if (state.activeDelivery) {
        state.activeDelivery.status = 'delivered';
        state.activeDelivery.deliveredAt = new Date();

        // Add to history
        state.deliveryHistory.unshift(state.activeDelivery);

        // Update stats
        state.stats.totalDeliveries += 1;
        state.stats.completedToday += 1;
        state.stats.totalEarnings += state.activeDelivery.courierEarnings;
        state.stats.todayEarnings += state.activeDelivery.courierEarnings;

        // Clear active delivery
        state.activeDelivery = null;
      }
    },
    setDeliveryHistory: (state, action: PayloadAction<ActiveDelivery[]>) => {
      state.deliveryHistory = action.payload;
    },
    setCourierStats: (state, action: PayloadAction<CourierStats>) => {
      state.stats = action.payload;
    },
    updateCourierStats: (state, action: PayloadAction<Partial<CourierStats>>) => {
      state.stats = { ...state.stats, ...action.payload };
    },
    setCourierLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setCourierError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    resetDailyStats: (state) => {
      state.stats.completedToday = 0;
      state.stats.todayEarnings = 0;
    },
    clearCourierData: (state) => {
      state.isOnline = false;
      state.availableRequests = [];
      state.activeDelivery = null;
      state.error = null;
    },
  },
});

export const {
  setOnlineStatus,
  setAvailableRequests,
  addDeliveryRequest,
  removeDeliveryRequest,
  setActiveDelivery,
  updateActiveDeliveryStatus,
  completeDelivery,
  setDeliveryHistory,
  setCourierStats,
  updateCourierStats,
  setCourierLoading,
  setCourierError,
  resetDailyStats,
  clearCourierData,
} = courierSlice.actions;

export default courierSlice;
