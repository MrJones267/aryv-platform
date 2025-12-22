/**
 * @fileoverview User management API service
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import BaseApiService, { ApiResponse } from './baseApi';

// Types
export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'passenger' | 'driver' | 'admin' | 'courier';
  status: 'active' | 'suspended' | 'pending_verification' | 'deactivated';
  profilePicture?: string;
  dateOfBirth?: Date;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  rating?: number;
  totalRides: number;
  joinDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
  profilePicture?: string;
}

export interface UserPreferences {
  language: 'en' | 'es' | 'fr';
  currency: 'USD' | 'EUR' | 'GBP';
  distanceUnit: 'km' | 'miles';
  theme: 'light' | 'dark' | 'system';
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  autoAcceptRides: boolean;
  maxWalkingDistance: number;
}

export interface UserStats {
  ridesCompleted: number;
  ridesOffered: number;
  totalDistance: number;
  totalSavings: number;
  co2Saved: number;
  rating: number;
  reviewCount: number;
  joinDate: string;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    unlockedAt: string;
    icon: string;
  }>;
}

export interface Review {
  id: string;
  fromUserId: string;
  toUserId: string;
  rideId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  fromUser: {
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

class UserApiService extends BaseApiService {
  /**
   * Get current user profile
   */
  async getProfile(): Promise<ApiResponse<User>> {
    return this.get<User>('/users/profile');
  }

  /**
   * Update user profile
   */
  async updateProfile(updateData: UpdateProfileData): Promise<ApiResponse<User>> {
    return this.patch<User>('/users/profile', updateData);
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(imageUri: string): Promise<ApiResponse<{ profilePictureUrl: string }>> {
    const formData = new FormData();
    formData.append('profilePicture', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'profile.jpg',
    } as any);

    return this.upload<{ profilePictureUrl: string }>('/users/upload-avatar', formData);
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.post<void>('/users/change-password', {
      currentPassword,
      newPassword,
    });
  }

  /**
   * Delete account
   */
  async deleteAccount(password: string): Promise<ApiResponse<void>> {
    return this.delete<void>('/users/account', {
      data: { password },
    });
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<ApiResponse<UserPreferences>> {
    return this.get<UserPreferences>('/users/preferences');
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: Partial<UserPreferences>): Promise<ApiResponse<UserPreferences>> {
    return this.patch<UserPreferences>('/users/preferences', preferences);
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<ApiResponse<UserStats>> {
    return this.get<UserStats>('/users/stats');
  }

  /**
   * Get user reviews
   */
  async getReviews(userId?: string, page = 1, limit = 20): Promise<ApiResponse<{
    reviews: Review[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    const endpoint = userId ? `/users/${userId}/reviews` : '/users/reviews';
    return this.get(endpoint, {
      params: { page, limit },
    });
  }

  /**
   * Submit a review for another user
   */
  async submitReview(
    toUserId: string,
    rideId: string,
    rating: number,
    comment?: string
  ): Promise<ApiResponse<Review>> {
    return this.post<Review>('/users/reviews', {
      toUserId,
      rideId,
      rating,
      comment,
    });
  }

  /**
   * Get user by ID (public profile)
   */
  async getUserById(userId: string): Promise<ApiResponse<{
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    rating: number;
    totalRides: number;
    joinDate: string;
    verifications: {
      email: boolean;
      phone: boolean;
      identity: boolean;
      driver: boolean;
    };
  }>> {
    return this.get(`/users/${userId}`);
  }

  /**
   * Report user
   */
  async reportUser(
    userId: string,
    reason: 'inappropriate_behavior' | 'harassment' | 'fraud' | 'other',
    description: string,
    rideId?: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.post('/users/report', {
      userId,
      reason,
      description,
      rideId,
    });
  }

  /**
   * Block user
   */
  async blockUser(userId: string): Promise<ApiResponse<{ message: string }>> {
    return this.post(`/users/${userId}/block`);
  }

  /**
   * Unblock user
   */
  async unblockUser(userId: string): Promise<ApiResponse<{ message: string }>> {
    return this.delete(`/users/${userId}/block`);
  }

  /**
   * Get blocked users
   */
  async getBlockedUsers(): Promise<ApiResponse<Array<{
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    blockedAt: string;
  }>>> {
    return this.get('/users/blocked');
  }

  /**
   * Update emergency contact
   */
  async updateEmergencyContact(contact: {
    name: string;
    phone: string;
    relationship: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.patch('/users/emergency-contact', contact);
  }

  /**
   * Get emergency contact
   */
  async getEmergencyContact(): Promise<ApiResponse<{
    name: string;
    phone: string;
    relationship: string;
  }>> {
    return this.get('/users/emergency-contact');
  }

  /**
   * Get user's vehicles
   */
  async getVehicles(): Promise<ApiResponse<Array<{
    id: string;
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    capacity: number;
    isVerified: boolean;
    status: 'active' | 'inactive' | 'maintenance' | 'suspended';
  }>>> {
    return this.get('/users/vehicles');
  }

  /**
   * Add vehicle
   */
  async addVehicle(vehicleData: {
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    type: 'sedan' | 'suv' | 'hatchback' | 'minivan';
    capacity: number;
  }): Promise<ApiResponse<{ id: string; message: string }>> {
    return this.post('/users/vehicles', vehicleData);
  }

  /**
   * Update vehicle
   */
  async updateVehicle(vehicleId: string, updates: {
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    licensePlate?: string;
    capacity?: number;
    status?: 'active' | 'inactive' | 'maintenance';
  }): Promise<ApiResponse<{ message: string }>> {
    return this.patch(`/users/vehicles/${vehicleId}`, updates);
  }

  /**
   * Delete vehicle
   */
  async deleteVehicle(vehicleId: string): Promise<ApiResponse<{ message: string }>> {
    return this.delete(`/users/vehicles/${vehicleId}`);
  }

  /**
   * Request driver verification
   */
  async requestDriverVerification(documents: {
    driverLicense: string;
    vehicleRegistration: string;
    insurance: string;
  }): Promise<ApiResponse<{ message: string }>> {
    const formData = new FormData();
    
    formData.append('driverLicense', {
      uri: documents.driverLicense,
      type: 'image/jpeg',
      name: 'driver-license.jpg',
    } as any);
    
    formData.append('vehicleRegistration', {
      uri: documents.vehicleRegistration,
      type: 'image/jpeg',
      name: 'vehicle-registration.jpg',
    } as any);
    
    formData.append('insurance', {
      uri: documents.insurance,
      type: 'image/jpeg',
      name: 'insurance.jpg',
    } as any);

    return this.upload<{ message: string }>('/users/driver-verification', formData);
  }
}

// Export singleton instance
export const userApi = new UserApiService();
export default userApi;