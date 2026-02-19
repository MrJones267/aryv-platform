/**
 * @fileoverview Package state slice for courier deliveries
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import PackageServiceInstance, { PackageCreationData } from '../../services/PackageService';

// Async thunks
export const createPackage = createAsyncThunk(
  'package/createPackage',
  async (packageData: PackageCreationData, { rejectWithValue }) => {
    try {
      const response = await PackageServiceInstance.createPackage(packageData);
      if (response.success && response.data) {
        return response.data;
      }
      return rejectWithValue(response.error || 'Failed to create package');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create package');
    }
  },
);

export const fetchAvailablePackages = createAsyncThunk(
  'package/fetchAvailable',
  async (_, { rejectWithValue }) => {
    try {
      const response = await PackageServiceInstance.getAvailablePackages();
      if (response.success && response.data) {
        return response.data;
      }
      return rejectWithValue(response.error || 'Failed to fetch packages');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch packages');
    }
  },
);

// Types
export interface PackageLocation {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  country?: string;
}

export interface Package {
  id: string;
  trackingCode: string;
  senderId: string;
  senderName: string;
  courierId?: string;
  courierName?: string;

  // Package details
  description: string;
  weight: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  category: string;
  isFragile: boolean;
  requiresSignature: boolean;

  // Locations
  pickupLocation: PackageLocation;
  deliveryLocation: PackageLocation;
  currentLocation?: PackageLocation;

  // Pricing
  price: number;
  platformFee: number;
  courierEarnings: number;
  currency: string;

  // Status
  status: 'pending' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  estimatedDelivery?: Date;

  // Additional
  notes?: string;
  photos?: string[];
  qrCode?: string;
}

export interface PackageState {
  packages: Package[];
  activePackage: Package | null;
  isLoading: boolean;
  error: string | null;
  filter: 'all' | 'pending' | 'in_transit' | 'delivered';
}

// Initial state
const initialState: PackageState = {
  packages: [],
  activePackage: null,
  isLoading: false,
  error: null,
  filter: 'all',
};

// Package slice
const packageSlice = createSlice({
  name: 'package',
  initialState,
  reducers: {
    setPackages: (state, action: PayloadAction<Package[]>) => {
      state.packages = action.payload;
      state.error = null;
    },
    addPackage: (state, action: PayloadAction<Package>) => {
      state.packages.unshift(action.payload);
    },
    updatePackage: (state, action: PayloadAction<{ id: string; updates: Partial<Package> }>) => {
      const index = state.packages.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.packages[index] = { ...state.packages[index], ...action.payload.updates };
      }
      if (state.activePackage?.id === action.payload.id) {
        state.activePackage = { ...state.activePackage, ...action.payload.updates };
      }
    },
    removePackage: (state, action: PayloadAction<string>) => {
      state.packages = state.packages.filter(p => p.id !== action.payload);
      if (state.activePackage?.id === action.payload) {
        state.activePackage = null;
      }
    },
    setActivePackage: (state, action: PayloadAction<Package | null>) => {
      state.activePackage = action.payload;
    },
    setPackageLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setPackageError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setPackageFilter: (state, action: PayloadAction<PackageState['filter']>) => {
      state.filter = action.payload;
    },
    updatePackageStatus: (state, action: PayloadAction<{ id: string; status: Package['status'] }>) => {
      const pkg = state.packages.find(p => p.id === action.payload.id);
      if (pkg) {
        pkg.status = action.payload.status;
        pkg.updatedAt = new Date();

        if (action.payload.status === 'picked_up') {
          pkg.pickedUpAt = new Date();
        } else if (action.payload.status === 'delivered') {
          pkg.deliveredAt = new Date();
        }
      }
      if (state.activePackage?.id === action.payload.id) {
        state.activePackage.status = action.payload.status;
      }
    },
    updatePackageLocation: (state, action: PayloadAction<{ id: string; location: PackageLocation }>) => {
      const pkg = state.packages.find(p => p.id === action.payload.id);
      if (pkg) {
        pkg.currentLocation = action.payload.location;
      }
      if (state.activePackage?.id === action.payload.id) {
        state.activePackage.currentLocation = action.payload.location;
      }
    },
    clearPackages: (state) => {
      state.packages = [];
      state.activePackage = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createPackage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createPackage.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.packages.unshift(action.payload as any);
        }
      })
      .addCase(createPackage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string || 'Failed to create package';
      })
      .addCase(fetchAvailablePackages.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAvailablePackages.fulfilled, (state, action) => {
        state.isLoading = false;
        state.packages = action.payload as any[];
      })
      .addCase(fetchAvailablePackages.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string || 'Failed to fetch packages';
      });
  },
});

export const {
  setPackages,
  addPackage,
  updatePackage,
  removePackage,
  setActivePackage,
  setPackageLoading,
  setPackageError,
  setPackageFilter,
  updatePackageStatus,
  updatePackageLocation,
  clearPackages,
} = packageSlice.actions;

export default packageSlice;
