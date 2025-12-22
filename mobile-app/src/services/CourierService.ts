/**
 * @fileoverview Courier Service API client with proper JWT authentication
 * @author Oabona-Majoko QA Protocol  
 * @created 2025-07-23
 * @lastModified 2025-07-23
 */

import { AuthService } from './AuthService';
import { ApiClient } from './ApiClient';

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
   * @returns {Promise<{success: boolean, data: any, error?: string}>}
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

    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error in acceptDelivery:`, {
        error: error.message,
        stack: error.stack,
        deliveryId: deliveryId,
        context: { endpoint: '/api/deliveries/accept' }
      });

      return {
        success: false,
        error: error.message,
        code: error.code || 'DELIVERY_ACCEPT_FAILED',
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
    } catch (error: any) {
      console.error('Error fetching available deliveries:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update delivery status with authentication
   * @param {string} deliveryId 
   * @param {string} status 
   * @returns {Promise<any>}
   */
  async updateDeliveryStatus(deliveryId: any, status: any) {
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
    } catch (error: any) {
      console.error('Error updating delivery status:', error);
      return { success: false, error: error.message };
    }
  }
}

export { CourierService };
export default CourierService;