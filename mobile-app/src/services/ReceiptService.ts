/**
 * @fileoverview Digital receipt generation and storage for completed rides
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import { getApiConfig } from '../config/api';
import logger from './LoggingService';

const log = logger.createLogger('ReceiptService');

export interface ReceiptLineItem {
  label: string;
  amount: number;
  type: 'charge' | 'discount' | 'tip';
}

export interface RideReceipt {
  id: string;
  rideId: string;
  receiptNumber: string;
  date: string;
  origin: string;
  destination: string;
  driverName: string;
  vehicleInfo: string;
  distance?: string;
  duration?: string;
  baseFare: number;
  lineItems: ReceiptLineItem[];
  totalAmount: number;
  tipAmount: number;
  currency: string;
  paymentMethod: string;
  status: 'paid' | 'pending';
}

const RECEIPTS_KEY = '@aryv_receipts';

class ReceiptService {
  private static instance: ReceiptService;

  static getInstance(): ReceiptService {
    if (!ReceiptService.instance) {
      ReceiptService.instance = new ReceiptService();
    }
    return ReceiptService.instance;
  }

  /**
   * Generate a receipt for a completed ride
   */
  generateReceipt(params: {
    rideId: string;
    origin: string;
    destination: string;
    driverName: string;
    vehicleInfo?: string;
    distance?: string;
    duration?: string;
    baseFare: number;
    promoDiscount?: number;
    promoCode?: string;
    tipAmount?: number;
    currency?: string;
    paymentMethod?: string;
  }): RideReceipt {
    const currency = params.currency || 'BWP';
    const lineItems: ReceiptLineItem[] = [
      { label: 'Ride fare', amount: params.baseFare, type: 'charge' },
    ];

    if (params.promoDiscount && params.promoDiscount > 0) {
      lineItems.push({
        label: params.promoCode ? `Promo (${params.promoCode})` : 'Promo discount',
        amount: -params.promoDiscount,
        type: 'discount',
      });
    }

    const tipAmount = params.tipAmount || 0;
    if (tipAmount > 0) {
      lineItems.push({ label: 'Driver tip', amount: tipAmount, type: 'tip' });
    }

    const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

    return {
      id: `rcpt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      rideId: params.rideId,
      receiptNumber: this.generateReceiptNumber(),
      date: new Date().toISOString(),
      origin: params.origin,
      destination: params.destination,
      driverName: params.driverName,
      vehicleInfo: params.vehicleInfo || '',
      distance: params.distance,
      duration: params.duration,
      baseFare: params.baseFare,
      lineItems,
      totalAmount: Math.max(0, totalAmount),
      tipAmount,
      currency,
      paymentMethod: params.paymentMethod || 'Wallet',
      status: 'paid',
    };
  }

  /**
   * Save receipt locally and attempt to sync with backend
   */
  async saveReceipt(receipt: RideReceipt): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(RECEIPTS_KEY);
      const receipts: RideReceipt[] = raw ? JSON.parse(raw) : [];
      receipts.push(receipt);
      // Keep last 200
      await AsyncStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts.slice(-200)));

      // Try to sync with backend
      this.syncReceipt(receipt).catch(() => {});
    } catch (error) {
      log.warn('Failed to save receipt', { error: String(error) });
    }
  }

  /**
   * Get all saved receipts
   */
  async getReceipts(): Promise<RideReceipt[]> {
    try {
      const raw = await AsyncStorage.getItem(RECEIPTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get receipt by ride ID
   */
  async getReceiptByRideId(rideId: string): Promise<RideReceipt | null> {
    const receipts = await this.getReceipts();
    return receipts.find((r) => r.rideId === rideId) || null;
  }

  /**
   * Share receipt as formatted text
   */
  async shareReceipt(receipt: RideReceipt): Promise<void> {
    const text = this.formatReceiptText(receipt);
    await Share.share({
      message: text,
      title: `ARYV Receipt #${receipt.receiptNumber}`,
    });
  }

  /**
   * Format receipt as shareable text
   */
  formatReceiptText(receipt: RideReceipt): string {
    const date = new Date(receipt.date);
    const dateStr = date.toLocaleDateString('en-BW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('en-BW', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let text = `ARYV - Ride Receipt\n`;
    text += `Receipt #${receipt.receiptNumber}\n`;
    text += `${'─'.repeat(30)}\n\n`;
    text += `Date: ${dateStr} at ${timeStr}\n`;
    text += `From: ${receipt.origin}\n`;
    text += `To: ${receipt.destination}\n`;
    if (receipt.distance) text += `Distance: ${receipt.distance}\n`;
    if (receipt.duration) text += `Duration: ${receipt.duration}\n`;
    text += `Driver: ${receipt.driverName}\n`;
    if (receipt.vehicleInfo) text += `Vehicle: ${receipt.vehicleInfo}\n`;
    text += `\n${'─'.repeat(30)}\n`;

    for (const item of receipt.lineItems) {
      const sign = item.amount < 0 ? '-' : ' ';
      const absAmount = Math.abs(item.amount);
      text += `${item.label.padEnd(22)} ${sign}${receipt.currency} ${absAmount.toFixed(0)}\n`;
    }

    text += `${'─'.repeat(30)}\n`;
    text += `TOTAL${' '.repeat(17)} ${receipt.currency} ${receipt.totalAmount.toFixed(0)}\n`;
    text += `Payment: ${receipt.paymentMethod}\n\n`;
    text += `Thank you for riding with ARYV!`;

    return text;
  }

  /**
   * Generate human-readable receipt number
   */
  private generateReceiptNumber(): string {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const seq = Math.floor(Math.random() * 9000 + 1000);
    return `ARV-${y}${m}${d}-${seq}`;
  }

  /**
   * Sync receipt with backend
   */
  private async syncReceipt(receipt: RideReceipt): Promise<void> {
    try {
      const { apiUrl } = getApiConfig();
      const token = await AsyncStorage.getItem('@aryv_auth_token')
        || await AsyncStorage.getItem('accessToken');

      if (apiUrl && token) {
        await fetch(`${apiUrl}/receipts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(receipt),
        });
      }
    } catch {
      // Silent fail — receipt is saved locally
    }
  }
}

export default ReceiptService;
