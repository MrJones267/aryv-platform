/**
 * @fileoverview Rides API service
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import BaseApiService, { ApiResponse } from './baseApi';

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
  departureTime: string;
  estimatedDuration?: number;
  distance?: number;
  availableSeats: number;
  pricePerSeat: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  description?: string;
  createdAt: string;
  updatedAt: string;
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    rating: number;
    totalRides: number;
  };
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    capacity: number;
  };
  bookings?: Array<{
    id: string;
    passengerId: string;
    seatsBooked: number;
    status: 'pending' | 'confirmed' | 'cancelled';
    passenger: {
      firstName: string;
      lastName: string;
      profilePicture?: string;
    };
  }>;
}

export interface CreateRideData {
  vehicleId: string;
  origin: Location;
  destination: Location;
  departureTime: string;
  availableSeats: number;
  pricePerSeat: number;
  description?: string;
  estimatedDuration?: number;
  distance?: number;
  preferences?: Record<string, unknown>;
  amenities?: string[];
}

export interface SearchRidesParams {
  origin: Location;
  destination: Location;
  departureDate: string;
  passengers: number;
  maxDistance?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export interface Booking {
  id: string;
  rideId: string;
  passengerId: string;
  seatsBooked: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
  updatedAt: string;
  ride: Ride;
  passenger: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    rating: number;
  };
}

export interface RideRequest {
  id: string;
  passengerId: string;
  origin: Location;
  destination: Location;
  departureTime: string;
  passengers: number;
  maxPrice: number;
  description?: string;
  status: 'active' | 'matched' | 'expired' | 'cancelled';
  createdAt: string;
  matches?: Ride[];
}

class RidesApiService extends BaseApiService {
  /**
   * Search for available rides
   */
  async searchRides(params: SearchRidesParams): Promise<ApiResponse<Ride[]>> {
    return this.get<Ride[]>('/rides/search', {
      params: {
        originLat: params.origin.latitude,
        originLng: params.origin.longitude,
        destinationLat: params.destination.latitude,
        destinationLng: params.destination.longitude,
        departureDate: params.departureDate,
        passengers: params.passengers,
        maxDistance: params.maxDistance || 500,
        maxPrice: params.maxPrice,
        page: params.page || 1,
        limit: params.limit || 20,
      },
    });
  }

  /**
   * Get ride by ID
   */
  async getRideDetails(rideId: string): Promise<ApiResponse<Ride>> {
    return this.get<Ride>(`/rides/${rideId}`);
  }

  /**
   * Create a new ride
   */
  async createRide(rideData: CreateRideData): Promise<ApiResponse<Ride>> {
    return this.post<Ride>('/rides', rideData);
  }

  /**
   * Update an existing ride
   */
  async updateRide(rideId: string, updates: Partial<CreateRideData>): Promise<ApiResponse<Ride>> {
    return this.patch<Ride>(`/rides/${rideId}`, updates);
  }

  /**
   * Cancel a ride
   */
  async cancelRide(rideId: string, reason?: string): Promise<ApiResponse<{ message: string }>> {
    return this.patch<{ message: string }>(`/rides/${rideId}/cancel`, { reason });
  }

  /**
   * Delete a ride
   */
  async deleteRide(rideId: string): Promise<ApiResponse<{ message: string }>> {
    return this.delete<{ message: string }>(`/rides/${rideId}`);
  }

  /**
   * Get user's rides (as driver)
   */
  async getMyRides(
    status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled',
    page = 1,
    limit = 20
  ): Promise<ApiResponse<{
    rides: Ride[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    return this.get('/rides/my-rides', {
      params: { status, page, limit },
    });
  }

  /**
   * Book a ride
   */
  async bookRide(rideId: string, seats: number, message?: string): Promise<ApiResponse<Booking>> {
    return this.post<Booking>(`/rides/${rideId}/book`, {
      seatsBooked: seats,
      message,
    });
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string, reason?: string): Promise<ApiResponse<{ message: string }>> {
    return this.patch<{ message: string }>(`/bookings/${bookingId}/cancel`, { reason });
  }

  /**
   * Get user's bookings (as passenger)
   */
  async getMyBookings(
    status?: 'pending' | 'confirmed' | 'cancelled' | 'completed',
    page = 1,
    limit = 20
  ): Promise<ApiResponse<{
    bookings: Booking[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    return this.get('/bookings/my-bookings', {
      params: { status, page, limit },
    });
  }

  /**
   * Get booking details
   */
  async getBookingDetails(bookingId: string): Promise<ApiResponse<Booking>> {
    return this.get<Booking>(`/bookings/${bookingId}`);
  }

  /**
   * Confirm a booking (driver action)
   */
  async confirmBooking(bookingId: string): Promise<ApiResponse<Booking>> {
    return this.patch<Booking>(`/bookings/${bookingId}/confirm`);
  }

  /**
   * Reject a booking (driver action)
   */
  async rejectBooking(bookingId: string, reason?: string): Promise<ApiResponse<{ message: string }>> {
    return this.patch<{ message: string }>(`/bookings/${bookingId}/reject`, { reason });
  }

  /**
   * Start a ride (driver action)
   */
  async startRide(rideId: string): Promise<ApiResponse<Ride>> {
    return this.patch<Ride>(`/rides/${rideId}/start`);
  }

  /**
   * Complete a ride (driver action)
   */
  async completeRide(rideId: string): Promise<ApiResponse<Ride>> {
    return this.patch<Ride>(`/rides/${rideId}/complete`);
  }

  /**
   * Create a ride request (passenger looking for rides)
   */
  async createRideRequest(requestData: {
    origin: Location;
    destination: Location;
    departureTime: string;
    passengers: number;
    maxPrice: number;
    description?: string;
  }): Promise<ApiResponse<RideRequest>> {
    return this.post<RideRequest>('/ride-requests', requestData);
  }

  /**
   * Get user's ride requests
   */
  async getMyRideRequests(
    status?: 'active' | 'matched' | 'expired' | 'cancelled',
    page = 1,
    limit = 20
  ): Promise<ApiResponse<{
    requests: RideRequest[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    return this.get('/ride-requests/my-requests', {
      params: { status, page, limit },
    });
  }

  /**
   * Cancel a ride request
   */
  async cancelRideRequest(requestId: string): Promise<ApiResponse<{ message: string }>> {
    return this.patch<{ message: string }>(`/ride-requests/${requestId}/cancel`);
  }

  /**
   * Get ride matches for a request
   */
  async getRideMatches(requestId: string): Promise<ApiResponse<Ride[]>> {
    return this.get<Ride[]>(`/ride-requests/${requestId}/matches`);
  }

  /**
   * Get ride history
   */
  async getRideHistory(
    page = 1,
    limit = 20,
    type?: 'driver' | 'passenger'
  ): Promise<ApiResponse<{
    rides: (Ride | Booking)[];
    stats: {
      totalRides: number;
      totalDistance: number;
      totalSavings: number;
      co2Saved: number;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    return this.get('/rides/history', {
      params: { page, limit, type },
    });
  }

  /**
   * Get popular routes
   */
  async getPopularRoutes(): Promise<ApiResponse<Array<{
    origin: Location;
    destination: Location;
    count: number;
    averagePrice: number;
  }>>> {
    return this.get('/rides/popular-routes');
  }

  /**
   * Get nearby rides
   */
  async getNearbyRides(
    latitude: number,
    longitude: number,
    radius = 10
  ): Promise<ApiResponse<Ride[]>> {
    return this.get('/rides/nearby', {
      params: { lat: latitude, lng: longitude, radius },
    });
  }

  /**
   * Report a ride issue
   */
  async reportRideIssue(
    rideId: string,
    type: 'no_show' | 'late' | 'route_change' | 'safety' | 'other',
    description: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.post('/rides/report', {
      rideId,
      type,
      description,
    });
  }

  /**
   * Get real-time ride updates (for active rides)
   */
  async getRideUpdates(rideId: string): Promise<ApiResponse<{
    currentLocation?: Coordinates;
    estimatedArrival?: string;
    status: string;
    updates: Array<{
      message: string;
      timestamp: string;
      type: 'info' | 'warning' | 'success';
    }>;
  }>> {
    return this.get(`/rides/${rideId}/updates`);
  }

  /**
   * Get ride by ID (alias for getRideDetails)
   */
  async getRideById(rideId: string): Promise<ApiResponse<Ride>> {
    return this.get<Ride>(`/rides/${rideId}`);
  }

  /**
   * Rate a ride
   */
  async rateRide(rideId: string, ratingData: {
    rating: number;
    tags?: string[];
    comment?: string;
    role?: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>(`/rides/${rideId}/rate`, ratingData);
  }
}

// Export singleton instance
export const ridesApi = new RidesApiService();
export default ridesApi;