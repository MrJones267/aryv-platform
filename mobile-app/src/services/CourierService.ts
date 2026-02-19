/**
 * @fileoverview Courier Service API client with proper JWT authentication
 * @author Oabona-Majoko QA Protocol  
 * @created 2025-07-23
 * @lastModified 2025-07-23
 */

import { AuthService } from './AuthService';
import { ApiClient } from './ApiClient';
import logger from './LoggingService';

const log = logger.createLogger('CourierService');

interface CourierProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  rating: number;
  completedDeliveries: number;
  earnings: {
    today: number;
    week: number;
    month: number;
    total: number;
  };
  vehicle: {
    type: 'bike' | 'motorcycle' | 'car' | 'van' | 'truck';
    model?: string;
    licensePlate?: string;
  };
  availability: {
    isOnline: boolean;
    workingHours: {
      start: string;
      end: string;
    };
  };
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
  };
}

interface DeliveryStats {
  todayDeliveries: number;
  weekDeliveries: number;
  monthDeliveries: number;
  totalDeliveries: number;
  averageRating: number;
  earnings: {
    today: number;
    week: number;
    month: number;
    total: number;
    pending: number;
  };
  performance: {
    acceptanceRate: number;
    completionRate: number;
    averageDeliveryTime: number;
    customerSatisfaction: number;
  };
}

interface CourierNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionRequired?: boolean;
}

class CourierService {
  private apiClient: ApiClient;
  private authService: AuthService;

  constructor() {
    this.apiClient = new ApiClient();
    this.authService = new AuthService();
  }

  /**
   * Driver accepts a delivery request with proper authentication
   * @param {string} deliveryId - The delivery request ID
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async acceptDelivery(deliveryId: string) {
    try {
      // CRITICAL FIX: Ensure JWT token is attached to the request
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication token not available. Please log in again.');
      }

      const response = await this.apiClient.post('/api/deliveries/accept', {
        deliveryId: deliveryId,
        driverId: await this.authService.getCurrentUser(),
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.success && response.data) {
        // Return the smart contract status for proper test assertion
        return {
          success: true,
          data: {
            deliveryId: response.data.deliveryId,
            smartContractAddress: response.data.smartContractAddress,
            contractStatus: response.data.contractStatus || 'pending', // Ensure status is never undefined
            escrowAmount: response.data.escrowAmount,
            driverId: response.data.driverId
          },
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error(response.error || 'Failed to accept delivery');
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof Error && 'code' in error
        ? (error as Error & { code?: string }).code
        : undefined;

      log.error('Error in acceptDelivery', error, {
        deliveryId: deliveryId,
        endpoint: '/api/deliveries/accept'
      });

      return {
        success: false,
        error: errorMessage,
        code: errorCode || 'DELIVERY_ACCEPT_FAILED',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get all available delivery requests for the current driver
   * @returns {Promise<Array>}
   */
  async getAvailableDeliveries() {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.get('/api/deliveries/available', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      return response;
    } catch (error: unknown) {
      log.error('Error fetching available deliveries:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get courier profile
   */
  async getCourierProfile(): Promise<{
    success: boolean;
    profile?: CourierProfile;
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.get('/api/courier/profile', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      return {
        success: response.success,
        profile: response.data,
        error: response.error
      };
    } catch (error: unknown) {
      log.error('Error fetching courier profile:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Update courier availability status
   */
  async updateAvailability(isOnline: boolean, location?: { lat: number; lng: number }): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.post('/api/courier/availability', {
        isOnline,
        location,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response;
    } catch (error: unknown) {
      log.error('Error updating availability:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Update courier location
   */
  async updateLocation(location: { latitude: number; longitude: number; accuracy: number }): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.post('/api/courier/location', {
        ...location,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response;
    } catch (error: unknown) {
      log.error('Error updating location:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(): Promise<{
    success: boolean;
    stats?: DeliveryStats;
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.get('/api/courier/stats', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      return {
        success: response.success,
        stats: response.data,
        error: response.error
      };
    } catch (error: unknown) {
      log.error('Error fetching delivery stats:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get courier notifications
   */
  async getNotifications(): Promise<{
    success: boolean;
    notifications?: CourierNotification[];
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.get('/api/courier/notifications', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      return {
        success: response.success,
        notifications: response.data,
        error: response.error
      };
    } catch (error: unknown) {
      log.error('Error fetching notifications:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.put(`/api/courier/notifications/${notificationId}`, {
        read: true
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response;
    } catch (error: unknown) {
      log.error('Error marking notification as read:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Update delivery status with authentication
   * @param {string} deliveryId 
   * @param {string} status 
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async updateDeliveryStatus(deliveryId: string, status: string) {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.put(`/api/deliveries/${deliveryId}/status`, {
        status: status,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response;
    } catch (error: unknown) {
      log.error('Error updating delivery status:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export { CourierService };
export default CourierService;