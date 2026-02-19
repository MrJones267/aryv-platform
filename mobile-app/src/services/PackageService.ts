/**
 * @fileoverview Package Service API client for package delivery operations
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { AuthService } from './AuthService';
import { ApiClient } from './ApiClient';
import logger from './LoggingService';

const log = logger.createLogger('PackageService');

export interface PackageCreationData {
  title: string;
  description?: string;
  dimensionsLength?: number;
  dimensionsWidth?: number;
  dimensionsHeight?: number;
  weight?: number;
  packageSize: 'small' | 'medium' | 'large' | 'custom';
  fragile: boolean;
  valuable: boolean;
  specialInstructions?: string;
  pickupAddress: string;
  pickupCoordinates: [number, number];
  pickupContactName?: string;
  pickupContactPhone?: string;
  dropoffAddress: string;
  dropoffCoordinates: [number, number];
  dropoffContactName?: string;
  dropoffContactPhone?: string;
  senderPriceOffer: number;
  packageImages?: string[];
  deliveryTierId?: string;
  requestedDeliveryTime?: string; // ISO 8601 date string
  urgencyLevel?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export interface DeliveryTier {
  id: string;
  tierType: 'lightning' | 'express' | 'standard' | 'economy';
  tierName: string;
  description: string;
  maxDeliveryHours: number;
  minDeliveryHours: number;
  basePriceMultiplier: number;
  platformFeePercentage: number;
  slaGuarantee: number;
  isActive: boolean;
}

export interface PricingSuggestion {
  tierType: 'lightning' | 'express' | 'standard' | 'economy';
  basePrice: number;
  demandMultiplier: number;
  finalPrice: number;
  platformFee: number;
  courierEarnings: number;
  estimatedDeliveryTime: string;
  demandLevel: 'LOW' | 'NORMAL' | 'HIGH' | 'SURGE';
}

export interface DemandInfo {
  locationHash: string;
  availableCouriers: number;
  activeDemand: number;
  demandMultiplier: number;
  lastUpdated: string;
}

export interface PackageTrackingData {
  package: Package;
  deliveryAgreement?: DeliveryAgreement;
  courierLocations?: {
    location: [number, number];
    timestamp: string;
    accuracy?: number;
    speed?: number;
  }[];
}

export interface Package {
  id: string;
  senderId: string;
  title: string;
  description?: string;
  packageSize: string;
  fragile: boolean;
  valuable: boolean;
  pickupAddress: string;
  dropoffAddress: string;
  distance?: number;
  senderPriceOffer: number;
  systemSuggestedPrice?: number;
  deliveryTierId?: string;
  requestedDeliveryTime?: string;
  urgencyLevel?: string;
  demandMultiplierApplied?: number;
  isActive: boolean;
  createdAt: string;
  status?: string;
}

export interface DeliveryAgreement {
  id: string;
  packageId: string;
  courierId: string;
  agreedPrice: number;
  platformFee: number;
  escrowAmount: number;
  status: string;
  createdAt: string;
  qrCodeToken?: string;
  package?: Package;
  courier?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}

class PackageService {
  private apiClient: ApiClient;
  private authService: AuthService;

  constructor() {
    this.apiClient = new ApiClient();
    this.authService = new AuthService();
  }

  /**
   * Get delivery tiers
   */
  async getDeliveryTiers(): Promise<{
    success: boolean;
    tiers?: DeliveryTier[];
    data?: DeliveryTier[];
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }
      
      // Validate token format and expiration
      const tokenValid = await this.authService.validateToken(authToken);
      if (!tokenValid) {
        throw new Error('Invalid or expired authentication token');
      }

      const response = await this.apiClient.get('/api/courier/delivery-tiers', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.success) {
        return {
          success: true,
          tiers: response.data,
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.error || 'Failed to fetch delivery tiers'
        };
      }
    } catch (error) {
      log.error('Error fetching delivery tiers', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get pricing suggestions for package delivery
   */
  async getPricingSuggestions(params: {
    pickupCoordinates: [number, number];
    dropoffCoordinates: [number, number];
    packageSize?: 'small' | 'medium' | 'large' | 'custom';
    fragile?: boolean;
    valuable?: boolean;
    requestedDeliveryTime?: string;
  }): Promise<{
    success: boolean;
    data?: {
      distance: number;
      pricingSuggestions: PricingSuggestion[];
      demandInfo: DemandInfo | null;
      calculatedAt: string;
    };
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.post('/api/courier/pricing/suggestions', params, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response;
    } catch (error) {
      log.error('Error fetching pricing suggestions:', error);
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  }

  /**
   * Create a new package delivery request
   */
  async createPackage(packageData: PackageCreationData): Promise<{
    success: boolean;
    package?: Package;
    data?: Package;
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.post('/api/courier/packages', packageData, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: response.success,
        package: response.data,
        data: response.data,
        error: response.error
      };
    } catch (error) {
      log.error('Error creating package:', error);
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  }

  /**
   * Get user's packages (sent packages)
   */
  async getUserPackages(): Promise<{
    success: boolean;
    data?: Package[];
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.get('/api/courier/user/packages', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      return response;
    } catch (error) {
      log.error('Error fetching user packages:', error);
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  }

  /**
   * Get available packages for couriers
   */
  async getAvailablePackages(filters?: {
    lat?: number;
    lng?: number;
    radius?: number;
    packageSizes?: string[];
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
    offset?: number;
  }): Promise<{
    success: boolean;
    packages?: Package[];
    data?: Package[];
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              value.forEach(v => queryParams.append(key, v.toString()));
            } else {
              queryParams.append(key, value.toString());
            }
          }
        });
      }

      const response = await this.apiClient.get(
        `/api/courier/available/packages?${queryParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      return {
        success: response.success,
        packages: response.data || [],
        data: response.data || [],
        error: response.error
      };
    } catch (error) {
      log.error('Error fetching available packages:', error);
      return {
        success: false,
        packages: [],
        data: [],
        error: (error as Error).message
      };
    }
  }

  /**
   * Get a single package by ID
   */
  async getPackageById(packageId: string): Promise<{
    success: boolean;
    data?: Package;
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();

      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.get(
        `/api/courier/packages/${packageId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      return {
        success: response.success,
        data: response.data,
        error: response.error
      };
    } catch (error) {
      log.error('Error fetching package by ID:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Accept a package for delivery with conflict resolution
   */
  async acceptPackage(packageId: string): Promise<{
    success: boolean;
    agreement?: DeliveryAgreement;
    error?: string;
    conflictResolution?: {
      alreadyAccepted: boolean;
      acceptedBy?: string;
      suggestedAlternatives?: string[];
    };
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }
      
      // Validate token format and expiration
      const tokenValid = await this.authService.validateToken(authToken);
      if (!tokenValid) {
        throw new Error('Invalid or expired authentication token');
      }

      const response = await this.apiClient.post(
        `/api/courier/packages/${packageId}/accept`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'X-Request-ID': `accept_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }
        }
      );

      // Handle conflict resolution responses
      if (!response.success && response.error?.includes('already accepted')) {
        const conflictData = response.data as { acceptedBy?: string; suggestedAlternatives?: string[] } | undefined;
        return {
          success: false,
          error: response.error,
          conflictResolution: {
            alreadyAccepted: true,
            acceptedBy: conflictData?.acceptedBy,
            suggestedAlternatives: conflictData?.suggestedAlternatives || []
          }
        };
      }

      if (response.success) {
        return {
          success: true,
          agreement: response.data
        };
      }

      return response;
    } catch (error) {
      log.error('Error accepting package:', error);
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  }

  /**
   * Confirm package pickup (courier action)
   */
  async confirmPickup(agreementId: string, location?: [number, number]): Promise<{
    success: boolean;
    data?: DeliveryAgreement;
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.post(
        `/api/courier/agreements/${agreementId}/pickup`,
        { location },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response;
    } catch (error) {
      log.error('Error confirming pickup:', error);
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  }

  /**
   * Verify delivery QR code (recipient action)
   */
  async verifyDeliveryQR(qrToken: string, location?: [number, number]): Promise<{
    success: boolean;
    packageId?: string;
    data?: unknown;
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.post(
        `/api/courier/verify-qr/${qrToken}`,
        { location },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response;
    } catch (error) {
      log.error('Error verifying delivery QR:', error);
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  }

  /**
   * Update courier location during delivery
   */
  async updateCourierLocation(
    agreementId: string, 
    location: [number, number],
    accuracy?: number,
    speed?: number,
    heading?: number
  ): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.post(
        `/api/courier/agreements/${agreementId}/location`,
        { location, accuracy, speed, heading },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response;
    } catch (error) {
      log.error('Error updating courier location:', error);
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  }

  /**
   * Get courier's active deliveries
   */
  async getCourierDeliveries(): Promise<{
    success: boolean;
    deliveries?: DeliveryAgreement[];
    data?: DeliveryAgreement[];
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.get('/api/courier/deliveries', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      return response;
    } catch (error) {
      log.error('Error fetching courier deliveries:', error);
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  }

  /**
   * Get package tracking information
   */
  async getPackageTracking(packageId: string): Promise<{
    success: boolean;
    trackingData?: PackageTrackingData;
    data?: PackageTrackingData;
    error?: string;
  }> {
    try {
      const authToken = await this.authService.getValidToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await this.apiClient.get(`/api/courier/packages/${packageId}/tracking`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      return response;
    } catch (error) {
      log.error('Error fetching package tracking:', error);
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  }
}

export { PackageService };
export default new PackageService();