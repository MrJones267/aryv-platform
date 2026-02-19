/**
 * @fileoverview Tipping service for post-ride driver tips
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiConfig } from '../config/api';
import logger from './LoggingService';

const log = logger.createLogger('TippingService');

export interface TipRecord {
  rideId: string;
  driverId: string;
  amount: number;
  currency: string;
  createdAt: string;
}

const TIPS_HISTORY_KEY = '@aryv_tips_history';

class TippingService {
  private static instance: TippingService;

  static getInstance(): TippingService {
    if (!TippingService.instance) {
      TippingService.instance = new TippingService();
    }
    return TippingService.instance;
  }

  /**
   * Get suggested tip amounts based on ride fare
   */
  getSuggestedAmounts(rideFare: number): number[] {
    if (rideFare <= 0) return [5, 10, 20];

    const pct10 = Math.round(rideFare * 0.1);
    const pct15 = Math.round(rideFare * 0.15);
    const pct20 = Math.round(rideFare * 0.2);

    // Ensure minimum tip of 5 BWP and round to nice numbers
    return [
      Math.max(5, this.roundToNice(pct10)),
      Math.max(10, this.roundToNice(pct15)),
      Math.max(15, this.roundToNice(pct20)),
    ];
  }

  /**
   * Round to nearest "nice" number for display
   */
  private roundToNice(amount: number): number {
    if (amount <= 10) return Math.round(amount);
    if (amount <= 50) return Math.round(amount / 5) * 5;
    return Math.round(amount / 10) * 10;
  }

  /**
   * Submit a tip to the backend
   */
  async submitTip(rideId: string, driverId: string, amount: number, currency: string = 'BWP'): Promise<boolean> {
    try {
      const { apiUrl } = getApiConfig();
      const token = await AsyncStorage.getItem('@aryv_auth_token')
        || await AsyncStorage.getItem('accessToken');

      if (apiUrl && token) {
        const response = await fetch(`${apiUrl}/rides/${rideId}/tip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ amount, currency }),
        });

        if (response.ok) {
          await this.recordTip({ rideId, driverId, amount, currency, createdAt: new Date().toISOString() });
          return true;
        }
      }

      // Store locally even if backend fails — can sync later
      await this.recordTip({ rideId, driverId, amount, currency, createdAt: new Date().toISOString() });
      return true;
    } catch (error) {
      log.error('Failed to submit tip', error);
      // Save locally for retry
      await this.recordTip({ rideId, driverId, amount, currency, createdAt: new Date().toISOString() });
      return false;
    }
  }

  /**
   * Record tip locally
   */
  private async recordTip(tip: TipRecord): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(TIPS_HISTORY_KEY);
      const history: TipRecord[] = raw ? JSON.parse(raw) : [];
      history.push(tip);
      // Keep last 100
      await AsyncStorage.setItem(TIPS_HISTORY_KEY, JSON.stringify(history.slice(-100)));
    } catch (error) {
      log.warn('Failed to record tip locally', { error: String(error) });
    }
  }

  /**
   * Get tip history
   */
  async getTipHistory(): Promise<TipRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(TIPS_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Check if a tip was already given for a ride
   */
  async hasTippedRide(rideId: string): Promise<boolean> {
    const history = await this.getTipHistory();
    return history.some((t) => t.rideId === rideId);
  }
}

export default TippingService;
