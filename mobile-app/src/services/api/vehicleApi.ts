/**
 * @fileoverview Vehicle management API service
 * @author Oabona-Majoko
 * @created 2025-10-27
 * @lastModified 2025-10-27
 */

import BaseApiService, { ApiResponse } from './baseApi';

// Types
export interface Vehicle {
  id: string;
  driverId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  type: 'sedan' | 'suv' | 'hatchback' | 'coupe' | 'truck' | 'van' | 'motorcycle';
  capacity: number;
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  isVerified: boolean;
  registrationDocument?: string;
  insuranceDocument?: string;
  inspectionExpiry?: Date;
  verificationSubmittedAt?: Date;
  createdAt: string;
  updatedAt: string;
  displayName: string;
}

export interface CreateVehicleData {
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  type: Vehicle['type'];
  capacity: number;
}

export interface UpdateVehicleData {
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  licensePlate?: string;
  type?: Vehicle['type'];
  capacity?: number;
}

class VehicleApiService extends BaseApiService {
  /**
   * Get user's registered vehicles
   */
  async getVehicles(): Promise<ApiResponse<Vehicle[]>> {
    return this.get<Vehicle[]>('/users/vehicles');
  }

  /**
   * Register a new vehicle
   */
  async registerVehicle(vehicleData: CreateVehicleData): Promise<ApiResponse<Vehicle>> {
    return this.post<Vehicle>('/users/vehicles', vehicleData);
  }

  /**
   * Update vehicle information
   */
  async updateVehicle(vehicleId: string, vehicleData: UpdateVehicleData): Promise<ApiResponse<Vehicle>> {
    return this.put<Vehicle>(`/users/vehicles/${vehicleId}`, vehicleData);
  }

  /**
   * Delete a vehicle
   */
  async deleteVehicle(vehicleId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/users/vehicles/${vehicleId}`);
  }

  /**
   * Submit vehicle for verification
   */
  async submitVehicleVerification(
    vehicleId: string,
    documents: {
      registrationDocument?: string;
      insuranceDocument?: string;
    }
  ): Promise<ApiResponse<Vehicle>> {
    return this.post<Vehicle>(`/users/vehicles/${vehicleId}/verify`, documents);
  }

  /**
   * Upload vehicle document
   */
  async uploadVehicleDocument(
    vehicleId: string,
    documentType: 'registration' | 'insurance',
    imageUri: string
  ): Promise<ApiResponse<{ documentUrl: string }>> {
    const formData = new FormData();
    formData.append('document', {
      uri: imageUri,
      type: 'image/jpeg',
      name: `${documentType}.jpg`,
    } as any);
    formData.append('documentType', documentType);

    return this.upload<{ documentUrl: string }>(`/users/vehicles/${vehicleId}/documents`, formData);
  }
}

export const vehicleApi = new VehicleApiService();
export default vehicleApi;