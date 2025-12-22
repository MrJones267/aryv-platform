/**
 * @fileoverview Escrow Payment Service - In-built escrow payment system
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { ApiClient } from './ApiClient';

export interface EscrowTransaction {
  id: string;
  rideId: string;
  bookingId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  platformFee: number;
  escrowAmount: number; // amount + platformFee
  status: 'initiated' | 'funded' | 'held' | 'released' | 'refunded' | 'disputed' | 'cancelled';
  paymentMethod: 'cash' | 'bank_transfer' | 'wallet' | 'card';
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  releasedAt?: string;
  refundedAt?: string;
  disputeId?: string;
  riskScore: number;
  holdReason?: string;
  releaseConditions: EscrowReleaseCondition[];
  disputeWindow: number; // Hours after release when disputes can be filed
}

export interface EscrowReleaseCondition {
  type: 'ride_completed' | 'driver_confirmed' | 'passenger_confirmed' | 'time_elapsed' | 'admin_approval';
  status: 'pending' | 'satisfied' | 'failed';
  requiredBy?: string; // userId if specific person required
  satisfiedAt?: string;
  satisfiedBy?: string;
  metadata?: Record<string, any>;
}

export interface EscrowCreateRequest {
  rideId: string;
  bookingId: string;
  payeeId: string; // Driver ID
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'wallet' | 'card';
  metadata?: {
    rideDetails?: Record<string, any>;
    autoReleaseHours?: number;
    requiresBothConfirmation?: boolean;
  };
}

export interface EscrowCreateResponse {
  success: boolean;
  escrowId?: string;
  transaction?: EscrowTransaction;
  paymentInstructions?: {
    method: string;
    instructions: string;
    deadline: string;
    confirmationCode?: string;
    qrCode?: string;
    bankDetails?: {
      accountName: string;
      accountNumber: string;
      bankName: string;
      routingNumber: string;
      reference: string;
    };
  };
  error?: string;
}

export interface EscrowReleaseRequest {
  escrowId: string;
  releaseType: 'automatic' | 'manual' | 'partial';
  amount?: number; // For partial releases
  reason: string;
  confirmationData?: {
    driverConfirmation?: boolean;
    passengerConfirmation?: boolean;
    rideCompleted?: boolean;
    location?: { lat: number; lng: number };
    timestamp?: string;
  };
}

export interface EscrowDisputeRequest {
  escrowId: string;
  disputeType: 'service_not_provided' | 'overcharge' | 'damage_claim' | 'safety_issue' | 'other';
  reason: string;
  description: string;
  evidence: {
    photos?: string[];
    documents?: string[];
    messages?: string[];
    witnesses?: string[];
  };
  requestedOutcome: 'full_refund' | 'partial_refund' | 'no_payment' | 'mediation';
  requestedAmount?: number;
}

export interface EscrowDisputeResponse {
  success: boolean;
  disputeId?: string;
  status?: 'pending' | 'under_review' | 'resolved' | 'rejected';
  estimatedResolutionTime?: string;
  nextSteps?: string[];
  error?: string;
}

export interface WalletBalance {
  availableBalance: number;
  escrowBalance: number;
  pendingBalance: number;
  totalBalance: number;
  currency: string;
  lastUpdated: string;
}

export interface EscrowStatistics {
  totalEscrowTransactions: number;
  totalEscrowVolume: number;
  successfulReleases: number;
  disputedTransactions: number;
  averageHoldTime: number; // Hours
  averageResolutionTime: number; // Hours for disputes
  trustScore: number;
}

export class EscrowPaymentService {
  private static apiClient = new ApiClient();

  /**
   * Create a new escrow transaction
   */
  static async createEscrowTransaction(request: EscrowCreateRequest): Promise<EscrowCreateResponse> {
    try {
      const response = await this.apiClient.post('/payments/escrow/create', request);
      
      if (response.success) {
        return {
          success: true,
          escrowId: response.data.escrowId,
          transaction: response.data.transaction,
          paymentInstructions: response.data.paymentInstructions,
        };
      } else {
        return {
          success: false,
          error: response.error || 'Failed to create escrow transaction',
        };
      }
    } catch (error: any) {
      console.error('Error creating escrow transaction:', error);
      return {
        success: false,
        error: error.message || 'Network error. Please try again.',
      };
    }
  }

  /**
   * Fund an escrow transaction (confirm payment made)
   */
  static async fundEscrow(
    escrowId: string, 
    paymentConfirmation: {
      method: string;
      confirmationCode?: string;
      transactionReference?: string;
      amount: number;
      location?: { lat: number; lng: number };
    }
  ): Promise<{ success: boolean; status?: string; message?: string; error?: string }> {
    try {
      const response = await this.apiClient.post(`/payments/escrow/${escrowId}/fund`, paymentConfirmation);
      
      if (response.success) {
        return {
          success: true,
          status: response.data.status,
          message: response.data.message,
        };
      } else {
        return {
          success: false,
          error: response.error || 'Failed to fund escrow',
        };
      }
    } catch (error: any) {
      console.error('Error funding escrow:', error);
      return {
        success: false,
        error: error.message || 'Network error. Please try again.',
      };
    }
  }

  /**
   * Release escrow funds to the payee (driver)
   */
  static async releaseEscrow(request: EscrowReleaseRequest): Promise<{ 
    success: boolean; 
    status?: string; 
    message?: string; 
    releasedAmount?: number;
    error?: string 
  }> {
    try {
      const response = await this.apiClient.post(`/payments/escrow/${request.escrowId}/release`, request);
      
      if (response.success) {
        return {
          success: true,
          status: response.data.status,
          message: response.data.message,
          releasedAmount: response.data.releasedAmount,
        };
      } else {
        return {
          success: false,
          error: response.error || 'Failed to release escrow',
        };
      }
    } catch (error: any) {
      console.error('Error releasing escrow:', error);
      return {
        success: false,
        error: error.message || 'Network error. Please try again.',
      };
    }
  }

  /**
   * Refund escrow funds to the payer (passenger)
   */
  static async refundEscrow(
    escrowId: string, 
    reason: string, 
    amount?: number
  ): Promise<{ success: boolean; status?: string; message?: string; refundedAmount?: number; error?: string }> {
    try {
      const payload = {
        reason,
        ...(amount && { amount })
      };

      const response = await this.apiClient.post(`/payments/escrow/${escrowId}/refund`, payload);
      
      if (response.success) {
        return {
          success: true,
          status: response.data.status,
          message: response.data.message,
          refundedAmount: response.data.refundedAmount,
        };
      } else {
        return {
          success: false,
          error: response.error || 'Failed to refund escrow',
        };
      }
    } catch (error: any) {
      console.error('Error refunding escrow:', error);
      return {
        success: false,
        error: error.message || 'Network error. Please try again.',
      };
    }
  }

  /**
   * File a dispute for an escrow transaction
   */
  static async fileDispute(request: EscrowDisputeRequest): Promise<EscrowDisputeResponse> {
    try {
      const response = await this.apiClient.post(`/payments/escrow/${request.escrowId}/dispute`, request);
      
      if (response.success) {
        return {
          success: true,
          disputeId: response.data.disputeId,
          status: response.data.status,
          estimatedResolutionTime: response.data.estimatedResolutionTime,
          nextSteps: response.data.nextSteps,
        };
      } else {
        return {
          success: false,
          error: response.error || 'Failed to file dispute',
        };
      }
    } catch (error: any) {
      console.error('Error filing dispute:', error);
      return {
        success: false,
        error: error.message || 'Network error. Please try again.',
      };
    }
  }

  /**
   * Get escrow transaction details
   */
  static async getEscrowTransaction(escrowId: string): Promise<EscrowTransaction | null> {
    try {
      const response = await this.apiClient.get(`/payments/escrow/${escrowId}`);
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Failed to get escrow transaction:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting escrow transaction:', error);
      return null;
    }
  }

  /**
   * Get escrow transactions for a ride
   */
  static async getEscrowByRide(rideId: string): Promise<EscrowTransaction[]> {
    try {
      const response = await this.apiClient.get(`/payments/escrow/ride/${rideId}`);
      
      if (response.success) {
        return response.data.transactions || [];
      } else {
        console.error('Failed to get ride escrow transactions:', response.error);
        return [];
      }
    } catch (error) {
      console.error('Error getting ride escrow transactions:', error);
      return [];
    }
  }

  /**
   * Get user's wallet balance
   */
  static async getWalletBalance(): Promise<WalletBalance | null> {
    try {
      const response = await this.apiClient.get('/payments/escrow/wallet/balance');
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Failed to get wallet balance:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      return null;
    }
  }

  /**
   * Get escrow statistics for user
   */
  static async getEscrowStatistics(): Promise<EscrowStatistics | null> {
    try {
      const response = await this.apiClient.get('/payments/escrow/statistics');
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Failed to get escrow statistics:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting escrow statistics:', error);
      return null;
    }
  }

  /**
   * Get escrow transaction history
   */
  static async getEscrowHistory(
    limit: number = 20, 
    offset: number = 0, 
    status?: string,
    dateRange?: { from: string; to: string }
  ): Promise<{
    transactions: EscrowTransaction[];
    total: number;
    limit: number;
    offset: number;
  } | null> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        ...(status && { status }),
        ...(dateRange && { 
          dateFrom: dateRange.from,
          dateTo: dateRange.to 
        })
      });

      const response = await this.apiClient.get(`/payments/escrow/history?${params}`);
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Failed to get escrow history:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting escrow history:', error);
      return null;
    }
  }

  /**
   * Check if escrow can be released automatically
   */
  static async canAutoRelease(escrowId: string): Promise<{
    canRelease: boolean;
    reason?: string;
    pendingConditions?: string[];
    estimatedReleaseTime?: string;
  }> {
    try {
      const response = await this.apiClient.get(`/payments/escrow/${escrowId}/auto-release-check`);
      
      if (response.success) {
        return response.data;
      } else {
        return {
          canRelease: false,
          reason: response.error || 'Unable to check release conditions',
        };
      }
    } catch (error) {
      console.error('Error checking auto-release conditions:', error);
      return {
        canRelease: false,
        reason: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Calculate platform fees for an escrow transaction
   */
  static calculatePlatformFee(amount: number, feeStructure?: {
    baseRate: number;
    minimumFee: number;
    maximumFee: number;
  }): number {
    const defaultStructure = {
      baseRate: 0.05, // 5%
      minimumFee: 0.50,
      maximumFee: 10.00
    };

    const structure = feeStructure || defaultStructure;
    const calculatedFee = amount * structure.baseRate;
    
    return Math.min(
      Math.max(calculatedFee, structure.minimumFee),
      structure.maximumFee
    );
  }

  /**
   * Format escrow status for display
   */
  static formatEscrowStatus(status: string): { text: string; color: string; icon: string } {
    switch (status) {
      case 'initiated':
        return { text: 'Payment Initiated', color: '#FFA500', icon: 'schedule' };
      case 'funded':
        return { text: 'Funds Secured', color: '#2196F3', icon: 'security' };
      case 'held':
        return { text: 'In Escrow', color: '#2196F3', icon: 'account_balance' };
      case 'released':
        return { text: 'Payment Released', color: '#4CAF50', icon: 'check_circle' };
      case 'refunded':
        return { text: 'Refunded', color: '#FF9800', icon: 'undo' };
      case 'disputed':
        return { text: 'Under Dispute', color: '#F44336', icon: 'gavel' };
      case 'cancelled':
        return { text: 'Cancelled', color: '#9E9E9E', icon: 'cancel' };
      default:
        return { text: status, color: '#9E9E9E', icon: 'help' };
    }
  }

  /**
   * Format release condition for display
   */
  static formatReleaseCondition(condition: EscrowReleaseCondition): string {
    switch (condition.type) {
      case 'ride_completed':
        return 'Ride completion confirmed';
      case 'driver_confirmed':
        return 'Driver confirmation required';
      case 'passenger_confirmed':
        return 'Passenger confirmation required';
      case 'time_elapsed':
        return 'Automatic release after time period';
      case 'admin_approval':
        return 'Admin approval required';
      default:
        return (condition.type as string).replace(/_/g, ' ');
    }
  }

  /**
   * Check if user can create escrow transactions
   */
  static async canCreateEscrow(amount: number): Promise<{
    canCreate: boolean;
    reason?: string;
    limits?: {
      daily: { used: number; limit: number };
      monthly: { used: number; limit: number };
    };
  }> {
    try {
      const response = await this.apiClient.post('/payments/escrow/eligibility-check', { amount });
      
      if (response.success) {
        return response.data;
      } else {
        return {
          canCreate: false,
          reason: response.error || 'Unable to verify escrow eligibility',
        };
      }
    } catch (error) {
      console.error('Error checking escrow eligibility:', error);
      return {
        canCreate: false,
        reason: 'Network error. Please try again.',
      };
    }
  }
}

export default EscrowPaymentService;