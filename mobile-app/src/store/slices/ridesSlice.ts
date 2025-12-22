/**
 * @fileoverview Rides state slice
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ridesApi } from '../../services/api/ridesApi';

// Utility function to transform ride data from API
const transformRideFromApi = (ride: any): Ride => {
  return {
    ...ride,
    departureTime: typeof ride.departureTime === 'string' ? new Date(ride.departureTime) : ride.departureTime,
    createdAt: typeof ride.createdAt === 'string' ? new Date(ride.createdAt) : ride.createdAt,
    updatedAt: typeof ride.updatedAt === 'string' ? new Date(ride.updatedAt) : ride.updatedAt,
  };
};

// Transform array of rides
const transformRidesFromApi = (rides: any[]): Ride[] => {
  return rides.map(transformRideFromApi);
};

// Types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location extends Coordinates {
  address: string;
}

export interface Ride {
  id: string;
  driverId: string;
  vehicleId: string;
  origin: Location;
  destination: Location;
  departureTime: Date;
  estimatedDuration?: number;
  distance?: number;
  availableSeats: number;
  pricePerSeat: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  driver?: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    rating?: number;
  };
  vehicle?: {
    id: string;
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    capacity: number;
  };
}

export interface RidesState {
  searchResults: Ride[];
  myRides: Ride[];
  bookings: any[];
  selectedRide: Ride | null;
  isLoading: boolean;
  searchLoading: boolean;
  bookingLoading: boolean;
  error: string | null;
  searchFilters: {
    origin?: Location;
    destination?: Location;
    departureDate?: Date;
    passengers: number;
    maxDistance: number;
    maxPrice?: number;
  };
  lastSearch?: number;
}

export interface SearchRidesParams {
  origin: Location;
  destination: Location;
  departureDate: Date;
  passengers: number;
  maxDistance?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export interface CreateRideData {
  vehicleId: string;
  origin: Location;
  destination: Location;
  departureTime: Date;
  availableSeats: number;
  pricePerSeat: number;
  description?: string;
  estimatedDuration?: number;
  distance?: number;
}

// Initial state
const initialState: RidesState = {
  searchResults: [],
  myRides: [],
  bookings: [],
  selectedRide: null,
  isLoading: false,
  searchLoading: false,
  bookingLoading: false,
  error: null,
  searchFilters: {
    passengers: 1,
    maxDistance: 10,
  },
};

// Async thunks
export const searchRides = createAsyncThunk(
  'rides/searchRides',
  async (searchParams: SearchRidesParams, { rejectWithValue }) => {
    try {
      const apiParams = {
        ...searchParams,
        departureDate: searchParams.departureDate.toISOString(),
      };
      const response = await ridesApi.searchRides(apiParams);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to search rides');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchMyRides = createAsyncThunk(
  'rides/fetchMyRides',
  async (_, { rejectWithValue }) => {
    try {
      const response = await ridesApi.getMyRides();
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch rides');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const createRide = createAsyncThunk(
  'rides/createRide',
  async (rideData: CreateRideData, { rejectWithValue }) => {
    try {
      const apiData = {
        ...rideData,
        departureTime: rideData.departureTime.toISOString(),
      };
      const response = await ridesApi.createRide(apiData);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to create ride');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const bookRide = createAsyncThunk(
  'rides/bookRide',
  async ({ rideId, seats }: { rideId: string; seats: number }, { rejectWithValue }) => {
    try {
      const response = await ridesApi.bookRide(rideId, seats);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to book ride');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const cancelRide = createAsyncThunk(
  'rides/cancelRide',
  async (rideId: string, { rejectWithValue }) => {
    try {
      const response = await ridesApi.cancelRide(rideId);
      
      if (response.success) {
        return rideId;
      } else {
        return rejectWithValue(response.error || 'Failed to cancel ride');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchRideDetails = createAsyncThunk(
  'rides/fetchRideDetails',
  async (rideId: string, { rejectWithValue }) => {
    try {
      const response = await ridesApi.getRideDetails(rideId);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch ride details');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

// Rides slice
const ridesSlice = createSlice({
  name: 'rides',
  initialState,
  reducers: {
    setRides: (state, action: PayloadAction<Ride[]>) => {
      state.searchResults = action.payload;
    },
    addRide: (state, action: PayloadAction<Ride>) => {
      state.myRides.unshift(action.payload);
    },
    updateRide: (state, action: PayloadAction<{ id: string; updates: Partial<Ride> }>) => {
      const { id, updates } = action.payload;
      
      // Update in search results
      const searchIndex = state.searchResults.findIndex(ride => ride.id === id);
      if (searchIndex !== -1) {
        state.searchResults[searchIndex] = { ...state.searchResults[searchIndex], ...updates };
      }
      
      // Update in my rides
      const myRideIndex = state.myRides.findIndex(ride => ride.id === id);
      if (myRideIndex !== -1) {
        state.myRides[myRideIndex] = { ...state.myRides[myRideIndex], ...updates };
      }
      
      // Update selected ride
      if (state.selectedRide && state.selectedRide.id === id) {
        state.selectedRide = { ...state.selectedRide, ...updates };
      }
    },
    removeRide: (state, action: PayloadAction<string>) => {
      const rideId = action.payload;
      state.searchResults = state.searchResults.filter(ride => ride.id !== rideId);
      state.myRides = state.myRides.filter(ride => ride.id !== rideId);
      if (state.selectedRide && state.selectedRide.id === rideId) {
        state.selectedRide = null;
      }
    },
    setSelectedRide: (state, action: PayloadAction<Ride | null>) => {
      state.selectedRide = action.payload;
    },
    setSearchFilters: (state, action: PayloadAction<Partial<RidesState['searchFilters']>>) => {
      state.searchFilters = { ...state.searchFilters, ...action.payload };
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
      state.lastSearch = undefined;
    },
    clearRides: (state) => {
      state.searchResults = [];
      state.myRides = [];
      state.bookings = [];
      state.selectedRide = null;
      state.error = null;
    },
    setRidesLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setSearchLoading: (state, action: PayloadAction<boolean>) => {
      state.searchLoading = action.payload;
    },
    setBookingLoading: (state, action: PayloadAction<boolean>) => {
      state.bookingLoading = action.payload;
    },
    setRidesError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearRidesError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Search rides cases
      .addCase(searchRides.pending, (state) => {
        state.searchLoading = true;
        state.error = null;
      })
      .addCase(searchRides.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = transformRidesFromApi(action.payload || []);
        state.lastSearch = Date.now();
        state.error = null;
      })
      .addCase(searchRides.rejected, (state, action) => {
        state.searchLoading = false;
        state.error = action.payload as string;
      })
      
      // Fetch my rides cases
      .addCase(fetchMyRides.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMyRides.fulfilled, (state, action) => {
        state.isLoading = false;
        state.myRides = transformRidesFromApi(action.payload?.rides || []);
        state.error = null;
      })
      .addCase(fetchMyRides.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Create ride cases
      .addCase(createRide.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createRide.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.myRides.unshift(transformRideFromApi(action.payload));
        }
        state.error = null;
      })
      .addCase(createRide.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Book ride cases
      .addCase(bookRide.pending, (state) => {
        state.bookingLoading = true;
        state.error = null;
      })
      .addCase(bookRide.fulfilled, (state, action) => {
        state.bookingLoading = false;
        state.bookings.push(action.payload);
        state.error = null;
      })
      .addCase(bookRide.rejected, (state, action) => {
        state.bookingLoading = false;
        state.error = action.payload as string;
      })
      
      // Cancel ride cases
      .addCase(cancelRide.fulfilled, (state, action) => {
        const rideId = action.payload;
        const rideIndex = state.myRides.findIndex(ride => ride.id === rideId);
        if (rideIndex !== -1) {
          state.myRides[rideIndex].status = 'cancelled';
        }
      })
      
      // Fetch ride details cases
      .addCase(fetchRideDetails.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRideDetails.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedRide = action.payload ? transformRideFromApi(action.payload) : null;
        state.error = null;
      })
      .addCase(fetchRideDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setRides,
  addRide,
  updateRide,
  removeRide,
  setSelectedRide,
  setSearchFilters,
  clearSearchResults,
  clearRides,
  setRidesLoading,
  setSearchLoading,
  setBookingLoading,
  setRidesError,
  clearRidesError,
} = ridesSlice.actions;

export default ridesSlice;