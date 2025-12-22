/**
 * @fileoverview Ride management slice for admin panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { rideService } from '../../services/api';

export interface Ride {
  id: string;
  driverId: string;
  origin: string;
  destination: string;
  departureTime: string;
  availableSeats: number;
  pricePerSeat: number;
  route: string[];
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  vehicleId: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  driver: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    rating: number;
  };
  vehicle: {
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
  };
  bookings: Booking[];
}

export interface Booking {
  id: string;
  rideId: string;
  passengerId: string;
  seatsBooked: number;
  totalAmount: number;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  bookingTime: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  passenger: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    rating: number;
  };
  ride: Ride;
}

interface RideFilters {
  status: 'all' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  dateFrom?: string;
  dateTo?: string;
  driverId?: string;
}

interface BookingFilters {
  status: 'all' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  paymentStatus: 'all' | 'pending' | 'paid' | 'refunded';
  rideId?: string;
  userId?: string;
}

interface RideState {
  rides: Ride[];
  bookings: Booking[];
  selectedRide: Ride | null;
  selectedBooking: Booking | null;
  loading: boolean;
  error: string | null;
  ridesPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  bookingsPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  rideFilters: RideFilters;
  bookingFilters: BookingFilters;
  stats: {
    totalRides: number;
    activeRides: number;
    completedRides: number;
    cancelledRides: number;
    totalBookings: number;
    totalRevenue: number;
    averageRating: number;
  };
}

const initialState: RideState = {
  rides: [],
  bookings: [],
  selectedRide: null,
  selectedBooking: null,
  loading: false,
  error: null,
  ridesPagination: {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  },
  bookingsPagination: {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  },
  rideFilters: {
    status: 'all',
  },
  bookingFilters: {
    status: 'all',
    paymentStatus: 'all',
  },
  stats: {
    totalRides: 0,
    activeRides: 0,
    completedRides: 0,
    cancelledRides: 0,
    totalBookings: 0,
    totalRevenue: 0,
    averageRating: 0,
  },
};

// Async thunks
export const fetchRides = createAsyncThunk(
  'rides/fetchRides',
  async (
    params: {
      page?: number;
      limit?: number;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      driverId?: string;
    } = {},
    { rejectWithValue }
  ) => {
    try {
      const response = await rideService.getRides(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch rides');
    }
  }
);

export const fetchRideById = createAsyncThunk('rides/fetchRideById', async (rideId: string, { rejectWithValue }) => {
  try {
    const response = await rideService.getRideById(rideId);
    return response.data.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch ride');
  }
});

export const updateRide = createAsyncThunk(
  'rides/updateRide',
  async ({ id, data }: { id: string; data: Partial<Ride> }, { rejectWithValue }) => {
    try {
      const response = await rideService.updateRide(id, data);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update ride');
    }
  }
);

export const cancelRide = createAsyncThunk(
  'rides/cancelRide',
  async ({ id, reason }: { id: string; reason: string }, { rejectWithValue }) => {
    try {
      await rideService.cancelRide(id, reason);
      return { id, status: 'cancelled', cancellationReason: reason };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel ride');
    }
  }
);

export const fetchBookings = createAsyncThunk(
  'rides/fetchBookings',
  async (
    params: {
      page?: number;
      limit?: number;
      status?: string;
      rideId?: string;
      userId?: string;
    } = {},
    { rejectWithValue }
  ) => {
    try {
      const response = await rideService.getBookings(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch bookings');
    }
  }
);

const rideSlice = createSlice({
  name: 'rides',
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },
    setRideFilters: (state, action: PayloadAction<Partial<RideFilters>>) => {
      state.rideFilters = { ...state.rideFilters, ...action.payload };
    },
    setBookingFilters: (state, action: PayloadAction<Partial<BookingFilters>>) => {
      state.bookingFilters = { ...state.bookingFilters, ...action.payload };
    },
    setSelectedRide: (state, action: PayloadAction<Ride | null>) => {
      state.selectedRide = action.payload;
    },
    setSelectedBooking: (state, action: PayloadAction<Booking | null>) => {
      state.selectedBooking = action.payload;
    },
    updateRideInList: (state, action: PayloadAction<Partial<Ride> & { id: string }>) => {
      const index = state.rides.findIndex(ride => ride.id === action.payload.id);
      if (index !== -1) {
        state.rides[index] = { ...state.rides[index], ...action.payload };
      }
    },
  },
  extraReducers: builder => {
    builder
      // Fetch rides
      .addCase(fetchRides.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRides.fulfilled, (state, action) => {
        state.loading = false;
        state.rides = action.payload.data;
        state.ridesPagination = action.payload.pagination;

        // Calculate stats
        state.stats.totalRides = action.payload.pagination.total;
        state.stats.activeRides = action.payload.data.filter(
          (r: Ride) => r.status === 'upcoming' || r.status === 'ongoing'
        ).length;
        state.stats.completedRides = action.payload.data.filter((r: Ride) => r.status === 'completed').length;
        state.stats.cancelledRides = action.payload.data.filter((r: Ride) => r.status === 'cancelled').length;
      })
      .addCase(fetchRides.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch ride by ID
      .addCase(fetchRideById.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRideById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedRide = action.payload;
      })
      .addCase(fetchRideById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Update ride
      .addCase(updateRide.fulfilled, (state, action) => {
        const index = state.rides.findIndex(ride => ride.id === action.payload.id);
        if (index !== -1) {
          state.rides[index] = action.payload;
        }
        if (state.selectedRide?.id === action.payload.id) {
          state.selectedRide = action.payload;
        }
      })
      .addCase(updateRide.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      // Cancel ride
      .addCase(cancelRide.fulfilled, (state, action) => {
        const { id, status } = action.payload;
        const index = state.rides.findIndex(ride => ride.id === id);
        if (index !== -1) {
          state.rides[index].status = status as any;
        }
        if (state.selectedRide?.id === id) {
          state.selectedRide.status = status as any;
        }
      })
      .addCase(cancelRide.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      // Fetch bookings
      .addCase(fetchBookings.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload.data;
        state.bookingsPagination = action.payload.pagination;

        // Calculate booking stats
        state.stats.totalBookings = action.payload.pagination.total;
        state.stats.totalRevenue = action.payload.data.reduce(
          (sum: number, b: Booking) => sum + (b.paymentStatus === 'paid' ? b.totalAmount : 0),
          0
        );
      })
      .addCase(fetchBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setRideFilters, setBookingFilters, setSelectedRide, setSelectedBooking, updateRideInList } =
  rideSlice.actions;

export default rideSlice.reducer;

// Selectors
export const selectRides = (state: { rides: RideState }) => state.rides.rides;
export const selectBookings = (state: { rides: RideState }) => state.rides.bookings;
export const selectSelectedRide = (state: { rides: RideState }) => state.rides.selectedRide;
export const selectSelectedBooking = (state: { rides: RideState }) => state.rides.selectedBooking;
export const selectRidesLoading = (state: { rides: RideState }) => state.rides.loading;
export const selectRidesError = (state: { rides: RideState }) => state.rides.error;
export const selectRidesPagination = (state: { rides: RideState }) => state.rides.ridesPagination;
export const selectBookingsPagination = (state: { rides: RideState }) => state.rides.bookingsPagination;
export const selectRideFilters = (state: { rides: RideState }) => state.rides.rideFilters;
export const selectBookingFilters = (state: { rides: RideState }) => state.rides.bookingFilters;
export const selectRideStats = (state: { rides: RideState }) => state.rides.stats;
