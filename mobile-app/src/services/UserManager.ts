/**
 * @fileoverview User Manager Service for centralized user data management
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { userApi } from './api/userApi';
import logger from './LoggingService';

const log = logger.createLogger('UserManager');

const USER_DATA_KEY = '@aryv_user_data';
const USER_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profilePicture?: string;
  primaryRole: 'passenger' | 'driver' | 'courier' | 'admin';
  roles: string[];
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isDriverVerified: boolean;
  rating?: number;
  totalRides: number;
  totalDeliveries: number;
  status: string;
  country?: string;
  currency?: string;
  dateOfBirth?: Date;
  memberSince?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
  vehicles?: unknown[];
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  profilePicture?: string;
  dateOfBirth?: Date;
  country?: string;
  currency?: string;
  primaryRole?: 'passenger' | 'driver' | 'courier';
}

interface CachedUserData {
  user: User;
  timestamp: number;
}

class UserManager {
  private currentUser: User | null = null;
  private cacheTimestamp: number = 0;
  private listeners: Set<(user: User | null) => void> = new Set();

  /**
   * Initialize UserManager and load cached user data
   */
  async initialize(): Promise<void> {
    try {
      const cachedData = await AsyncStorage.getItem(USER_DATA_KEY);
      if (cachedData) {
        const parsed: CachedUserData = JSON.parse(cachedData);
        this.currentUser = parsed.user;
        this.cacheTimestamp = parsed.timestamp;
      }
    } catch (error) {
      log.error('Failed to load cached user data', error);
    }
  }

  /**
   * Get the current user (from cache)
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid(): boolean {
    if (!this.currentUser || !this.cacheTimestamp) {
      return false;
    }
    return Date.now() - this.cacheTimestamp < USER_CACHE_EXPIRY;
  }

  /**
   * Set the current user and persist to cache
   */
  async setUser(user: User): Promise<void> {
    this.currentUser = user;
    this.cacheTimestamp = Date.now();

    const cachedData: CachedUserData = {
      user,
      timestamp: this.cacheTimestamp,
    };

    try {
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(cachedData));
    } catch (error) {
      log.error('Failed to cache user data', error);
    }

    this.notifyListeners();
  }

  /**
   * Clear the current user data
   */
  async clearUser(): Promise<void> {
    this.currentUser = null;
    this.cacheTimestamp = 0;

    try {
      await AsyncStorage.removeItem(USER_DATA_KEY);
    } catch (error) {
      log.error('Failed to clear user data', error);
    }

    this.notifyListeners();
  }

  /**
   * Update user profile and sync to server
   */
  async updateProfile(updateData: UpdateProfileData): Promise<User> {
    try {
      const response = await userApi.updateProfile(updateData);

      if (response.success && response.data) {
        const userData = response.data as unknown as User;
        await this.setUser(userData);
        return userData;
      } else {
        throw new Error(response.error || 'Failed to update profile');
      }
    } catch (error: unknown) {
      // If API fails, update locally only
      if (this.currentUser) {
        const updatedUser: User = {
          ...this.currentUser,
          ...updateData,
          updatedAt: new Date(),
        };
        await this.setUser(updatedUser);
        return updatedUser;
      }
      throw error;
    }
  }

  /**
   * Sync user data from server
   */
  async syncFromServer(): Promise<User | null> {
    try {
      const response = await userApi.getProfile();

      if (response.success && response.data) {
        const userData = response.data as unknown as User;
        await this.setUser(userData);
        return userData;
      }
      return null;
    } catch (error) {
      log.error('Failed to sync from server', error);
      return null;
    }
  }

  /**
   * Subscribe to user changes
   */
  subscribe(listener: (user: User | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of user changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      listener(this.currentUser);
    });
  }

  /**
   * Update specific user fields locally
   */
  updateLocally(updates: Partial<User>): void {
    if (this.currentUser) {
      this.currentUser = {
        ...this.currentUser,
        ...updates,
      };
      this.notifyListeners();
    }
  }
}

// Export singleton instance
const userManager = new UserManager();
export default userManager;
