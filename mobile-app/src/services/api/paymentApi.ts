/**
 * @fileoverview Payment API service for Stripe, mobile money, and wallet transactions
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import BaseApiService, { ApiResponse } from './baseApi';

// ─── Types ────────────────────────────────────────

export type PaymentMethodType = 'card' | 'mobile_money' | 'cash' | 'wallet';
export type PaymentProvider = 'stripe' | 'orange_money' | 'mtn_momo' | 'mpesa' | 'fnb_ewallet' | 'cash';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export interface SavedPaymentMethod {
  id: string;
  type: PaymentMethodType;
  provider: PaymentProvider;
  label: string;
  last4?: string;
  expiryDate?: string;
  phone?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface PaymentIntent {
  id: string;
  clientSecret?: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethodType;
  provider: PaymentProvider;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentData {
  amount: number;
  currency: string;
  paymentMethod: PaymentMethodType;
  provider?: PaymentProvider;
  rideId?: string;
  packageId?: string;
  metadata?: Record<string, string>;
}

export interface ConfirmPaymentData {
  paymentIntentId: string;
  paymentMethodId?: string;
  cardToken?: string;
  mobileMoneyPhone?: string;
  mobileMoneyProvider?: PaymentProvider;
}

export interface AddCardData {
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  cardholderName: string;
  setAsDefault?: boolean;
}

export interface AddMobileMoneyData {
  phone: string;
  provider: PaymentProvider;
  accountName?: string;
  setAsDefault?: boolean;
}

export interface WalletBalance {
  available: number;
  pending: number;
  currency: string;
  lastUpdated: string;
}

export interface PaymentTransaction {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  status: TransactionStatus;
  type: 'ride_payment' | 'delivery_payment' | 'tip' | 'refund' | 'wallet_topup' | 'payout';
  paymentMethod: PaymentMethodType;
  provider: PaymentProvider;
  rideId?: string;
  packageId?: string;
  description: string;
  createdAt: string;
  completedAt?: string;
}

// ─── Service ──────────────────────────────────────

class PaymentApiService extends BaseApiService {
  // ─── Payment Methods ────────────────────────────

  async getPaymentMethods(): Promise<ApiResponse<SavedPaymentMethod[]>> {
    return this.get<SavedPaymentMethod[]>('/payments/methods');
  }

  async addCard(data: AddCardData): Promise<ApiResponse<SavedPaymentMethod>> {
    return this.post<SavedPaymentMethod>('/payments/methods/card', data);
  }

  async addMobileMoney(data: AddMobileMoneyData): Promise<ApiResponse<SavedPaymentMethod>> {
    return this.post<SavedPaymentMethod>('/payments/methods/mobile-money', data);
  }

  async removePaymentMethod(methodId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/payments/methods/${methodId}`);
  }

  async setDefaultPaymentMethod(methodId: string): Promise<ApiResponse<SavedPaymentMethod>> {
    return this.put<SavedPaymentMethod>(`/payments/methods/${methodId}/default`);
  }

  // ─── Payment Intents ────────────────────────────

  async createPaymentIntent(data: CreatePaymentIntentData): Promise<ApiResponse<PaymentIntent>> {
    return this.post<PaymentIntent>('/payments/intents', data);
  }

  async confirmPayment(data: ConfirmPaymentData): Promise<ApiResponse<PaymentIntent>> {
    return this.post<PaymentIntent>('/payments/confirm', data);
  }

  async cancelPayment(paymentIntentId: string): Promise<ApiResponse<PaymentIntent>> {
    return this.post<PaymentIntent>(`/payments/intents/${paymentIntentId}/cancel`);
  }

  async getPaymentStatus(paymentIntentId: string): Promise<ApiResponse<PaymentIntent>> {
    return this.get<PaymentIntent>(`/payments/intents/${paymentIntentId}`);
  }

  // ─── Mobile Money ──────────────────────────────

  async initiateMobileMoneyPayment(
    paymentIntentId: string,
    phone: string,
    provider: PaymentProvider
  ): Promise<ApiResponse<{ ussdCode?: string; reference: string; status: string }>> {
    return this.post(`/payments/mobile-money/initiate`, {
      paymentIntentId,
      phone,
      provider,
    });
  }

  async checkMobileMoneyStatus(
    reference: string
  ): Promise<ApiResponse<{ status: TransactionStatus; message?: string }>> {
    return this.get(`/payments/mobile-money/status/${reference}`);
  }

  // ─── Wallet ────────────────────────────────────

  async getWalletBalance(): Promise<ApiResponse<WalletBalance>> {
    return this.get<WalletBalance>('/payments/wallet/balance');
  }

  async topUpWallet(
    amount: number,
    currency: string,
    paymentMethodId: string
  ): Promise<ApiResponse<PaymentIntent>> {
    return this.post<PaymentIntent>('/payments/wallet/topup', {
      amount,
      currency,
      paymentMethodId,
    });
  }

  async requestPayout(
    amount: number,
    currency: string,
    paymentMethodId: string
  ): Promise<ApiResponse<{ payoutId: string; status: string; estimatedArrival: string }>> {
    return this.post('/payments/wallet/payout', {
      amount,
      currency,
      paymentMethodId,
    });
  }

  // ─── Transactions ──────────────────────────────

  async getTransactions(params?: {
    page?: number;
    limit?: number;
    type?: PaymentTransaction['type'];
    status?: TransactionStatus;
  }): Promise<ApiResponse<{ transactions: PaymentTransaction[]; total: number; page: number }>> {
    return this.get('/payments/transactions', { params });
  }

  async getTransactionDetails(transactionId: string): Promise<ApiResponse<PaymentTransaction>> {
    return this.get<PaymentTransaction>(`/payments/transactions/${transactionId}`);
  }

  // ─── Refunds ───────────────────────────────────

  async requestRefund(
    transactionId: string,
    reason: string,
    amount?: number
  ): Promise<ApiResponse<{ refundId: string; status: string; amount: number }>> {
    return this.post('/payments/refunds', {
      transactionId,
      reason,
      amount,
    });
  }
}

export const paymentApi = new PaymentApiService();
export default paymentApi;
