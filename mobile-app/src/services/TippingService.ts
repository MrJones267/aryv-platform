/**
 * @fileoverview Tipping service for post-ride driver tips
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-11-05
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
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
   * Note a tip the rider is handing to the driver in cash.
   *
   * Rides are paid in cash, so nothing is sent anywhere: the tip is kept on
   * the phone for the ride receipt and so the same ride is not offered a tip
   * twice. This used to post to /rides/:id/tip, which does not exist, and
   * report success anyway, so the rider was told the driver had the tip.
   */
  async recordCashTip(rideId: string, driverId: string, amount: number, currency: string = 'BWP'): Promise<void> {
    await this.recordTip({ rideId, driverId, amount, currency, createdAt: new Date().toISOString() });
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
