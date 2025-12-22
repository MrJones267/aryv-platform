/**
 * @fileoverview Cash Payment Service for mobile app API communication
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { ApiClient } from './ApiClient';

export interface CashPaymentRequest {
  bookingId: string;
  driverId: string;
  amount: number;
}

export interface CashPaymentResponse {
  success: boolean;
  transactionId: string;
  riderCode: string;
  instructions: string;
  trustScore: number;
  error?: string;
}

export interface ConfirmationResponse {
  success: boolean;
  status: string;
  message: string;
  nextStep?: string;
  error?: string;
}

export interface CashTransactionDetails {
  id: string;
  bookingId: string;
  amount: number;
  expectedAmount: number;
  actualAmountClaimed?: number;
  status: string;
  platformFee: number;
  riderConfirmedAt?: string;
  driverConfirmedAt?: string;
  createdAt: string;
  expiresAt: string;
  riskScore: number;
  confirmationCode: string;
  userRole: 'rider' | 'driver';
}

export interface WalletInfo {
  trustScore: number;
  verificationLevel: 'basic' | 'verified' | 'premium';
  completedTransactions: number;
  disputedTransactions: number;
  dailyCashLimit: number;
  weeklyCashLimit: number;
  monthlyCashLimit: number;
  dailyCashUsed: number;
  weeklyCashUsed: number;
  monthlyCashUsed: number;
  phoneVerified: boolean;
  idVerified: boolean;
  addressVerified: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
}

export interface DisputeRequest {
  reason: string;
  description: string;
  evidence?: string[];
}

export interface DisputeResponse {
  success: boolean;
  disputeId: string;
  status: string;
  message: string;
}

export interface TransactionHistoryResponse {
  success: boolean;
  transactions: Array<{
    id: string;
    bookingId: string;
    amount: number;
    status: string;
    platformFee: number;
    createdAt: string;
    userRole: 'rider' | 'driver';
    riskScore: number;
  }>;
  total: number;
  limit: number;
  offset: number;
}

export class CashPaymentService {
  private static apiClient = new ApiClient();

  /**
   * Create a new cash payment transaction
   */
  static async createCashPayment(request: CashPaymentRequest): Promise<CashPaymentResponse> {
    try {
      const response = await this.apiClient.post('/payments/cash/create', request);
      
      if (response.success) {
        return {
          success: true,
          transactionId: response.data.transactionId,
          riderCode: response.data.riderCode,
          instructions: response.data.instructions,
          trustScore: response.data.trustScore,
        };
      } else {
        return {
          success: false,
          error: response.error || 'Failed to create cash payment',
          transactionId: '',
          riderCode: '',
          instructions: '',
          trustScore: 0,
        };
      }
    } catch (error) {
      console.error('Error creating cash payment:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
        transactionId: '',
        riderCode: '',
        instructions: '',
        trustScore: 0,
      };
    }
  }

  /**
   * Driver confirms cash received
   */
  static async confirmCashReceived(
    transactionId: string, 
    actualAmount: number, 
    location?: { lat: number; lng: number }
  ): Promise<ConfirmationResponse> {
    try {
      const payload = {
        actualAmount,
        ...(location && { location })
      };

      const response = await this.apiClient.post(
        `/payments/cash/${transactionId}/confirm-received`, 
        payload
      );
      
      if (response.success) {
        return {
          success: true,
          status: response.data.status,
          message: response.data.message,
          nextStep: response.data.nextStep,
        };
      } else {
        return {
          success: false,
          status: 'failed',
          message: response.error || 'Failed to confirm cash received',
        };
      }
    } catch (error) {
      console.error('Error confirming cash received:', error);
      return {
        success: false,
        status: 'error',
        message: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Rider confirms cash payment made
   */
  static async confirmCashPaid(
    transactionId: string, 
    confirmationCode: string
  ): Promise<ConfirmationResponse> {
    try {
      const response = await this.apiClient.post(
        `/payments/cash/${transactionId}/confirm-paid`, 
        { confirmationCode }
      );
      
      if (response.success) {
        return {
          success: true,
          status: response.data.status,
          message: response.data.message,
          nextStep: response.data.nextStep,
        };
      } else {
        return {
          success: false,
          status: 'failed',
          message: response.error || 'Failed to confirm cash payment',
        };
      }
    } catch (error) {
      console.error('Error confirming cash paid:', error);
      return {
        success: false,
        status: 'error',
        message: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Get cash transaction details
   */
  static async getCashTransaction(transactionId: string): Promise<CashTransactionDetails | null> {
    try {
      const response = await this.apiClient.get(`/payments/cash/${transactionId}`);
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Failed to get transaction details:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting transaction details:', error);
      return null;
    }
  }

  /**
   * Get user's transaction history
   */
  static async getTransactionHistory(
    limit: number = 20, 
    offset: number = 0, 
    status?: string
  ): Promise<TransactionHistoryResponse | null> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        ...(status && { status })
      });

      const response = await this.apiClient.get(`/payments/cash/history?${params}`);
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Failed to get transaction history:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting transaction history:', error);
      return null;
    }
  }

  /**
   * Get user's wallet information
   */
  static async getWalletInfo(): Promise<WalletInfo | null> {
    try {
      const response = await this.apiClient.get('/payments/cash/wallet');
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Failed to get wallet info:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting wallet info:', error);
      return null;
    }
  }

  /**
   * Report a dispute with a cash transaction
   */
  static async reportDispute(
    transactionId: string, 
    dispute: DisputeRequest
  ): Promise<DisputeResponse> {
    try {
      const response = await this.apiClient.post(
        `/payments/cash/${transactionId}/dispute`, 
        dispute
      );
      
      if (response.success) {
        return {
          success: true,
          disputeId: response.data.disputeId,
          status: response.data.status,
          message: response.data.message,
        };
      } else {
        return {
          success: false,
          disputeId: '',
          status: 'failed',
          message: response.error || 'Failed to report dispute',
        };
      }
    } catch (error) {
      console.error('Error reporting dispute:', error);
      return {
        success: false,
        disputeId: '',
        status: 'error',
        message: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Check if user can make cash payments (based on trust score and limits)
   */
  static async canMakeCashPayment(amount: number): Promise<{ canPay: boolean; reason?: string; trustScore?: number }> {
    try {
      const walletInfo = await this.getWalletInfo();
      
      if (!walletInfo) {
        return {
          canPay: false,
          reason: 'Unable to verify account status',
        };
      }

      if (walletInfo.isSuspended) {
        return {
          canPay: false,
          reason: walletInfo.suspensionReason || 'Account is suspended',
          trustScore: walletInfo.trustScore,
        };
      }

      // Check daily limit
      if (walletInfo.dailyCashUsed + amount > walletInfo.dailyCashLimit) {
        return {
          canPay: false,
          reason: `Daily limit exceeded. Available: $${(walletInfo.dailyCashLimit - walletInfo.dailyCashUsed).toFixed(2)}`,
          trustScore: walletInfo.trustScore,
        };
      }

      // Check trust score requirements
      const requiredTrust = this.calculateRequiredTrust(amount);
      if (walletInfo.trustScore < requiredTrust) {
        return {
          canPay: false,
          reason: `Trust score too low. Required: ${requiredTrust}, Current: ${walletInfo.trustScore}`,
          trustScore: walletInfo.trustScore,
        };
      }

      return {
        canPay: true,
        trustScore: walletInfo.trustScore,
      };
    } catch (error) {
      console.error('Error checking payment eligibility:', error);
      return {
        canPay: false,
        reason: 'Unable to verify payment eligibility',
      };
    }
  }

  /**
   * Calculate required trust score for given amount
   */
  private static calculateRequiredTrust(amount: number): number {
    if (amount <= 10) return 20;
    if (amount <= 50) return 40;
    if (amount <= 100) return 60;
    if (amount <= 500) return 80;
    return 90;
  }

  /**
   * Format cash payment status for display
   */
  static formatPaymentStatus(status: string): { text: string; color: string } {
    switch (status) {
      case 'pending_verification':
        return { text: 'Pending Verification', color: '#FFA500' };
      case 'driver_confirmed':
        return { text: 'Driver Confirmed', color: '#2196F3' };
      case 'rider_confirmed':
        return { text: 'Rider Confirmed', color: '#2196F3' };
      case 'both_confirmed':
        return { text: 'Both Confirmed', color: '#4CAF50' };
      case 'completed':
        return { text: 'Completed', color: '#4CAF50' };
      case 'disputed':
        return { text: 'Disputed', color: '#F44336' };
      case 'failed':
        return { text: 'Failed', color: '#F44336' };
      case 'expired':
        return { text: 'Expired', color: '#9E9E9E' };
      default:
        return { text: status, color: '#9E9E9E' };
    }
  }

  /**
   * Get payment method icon name
   */
  static getPaymentMethodIcon(method: string): string {
    switch (method) {
      case 'cash':
        return 'attach-money';
      case 'stripe':
        return 'credit-card';
      case 'paypal':
        return 'account-balance';
      default:
        return 'payment';
    }
  }
}

export default CashPaymentService;