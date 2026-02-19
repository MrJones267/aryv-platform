/**
 * @fileoverview Promo and referral code service for discounts and growth
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiConfig } from '../config/api';
import logger from './LoggingService';

const log = logger.createLogger('PromoCodeService');

export interface PromoCode {
  code: string;
  type: 'percentage' | 'fixed' | 'referral';
  value: number; // percentage or fixed amount
  currency?: string;
  description: string;
  expiresAt?: string;
  minRideAmount?: number;
  maxDiscount?: number;
  usesRemaining?: number;
  isActive: boolean;
}

export interface AppliedPromo {
  code: string;
  discount: number;
  description: string;
}

const APPLIED_PROMOS_KEY = '@aryv_applied_promos';
const REFERRAL_CODE_KEY = '@aryv_my_referral_code';

class PromoCodeService {
  private static instance: PromoCodeService;

  static getInstance(): PromoCodeService {
    if (!PromoCodeService.instance) {
      PromoCodeService.instance = new PromoCodeService();
    }
    return PromoCodeService.instance;
  }

  /**
   * Validate a promo code against the backend
   */
  async validateCode(code: string): Promise<PromoCode | null> {
    try {
      const { apiUrl } = getApiConfig();
      const token = await AsyncStorage.getItem('@aryv_auth_token')
        || await AsyncStorage.getItem('accessToken');

      if (apiUrl && token) {
        const response = await fetch(`${apiUrl}/promos/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ code: code.toUpperCase().trim() }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.promo) {
            return data.promo;
          }
        }
      }

      // Fallback: check known local promos (for demo/testing)
      return this.checkLocalPromos(code.toUpperCase().trim());
    } catch (error) {
      log.error('Validation failed', error);
      return this.checkLocalPromos(code.toUpperCase().trim());
    }
  }

  /**
   * Apply a promo code to a ride amount
   */
  calculateDiscount(promo: PromoCode, rideAmount: number): number {
    if (!promo.isActive) return 0;
    if (promo.minRideAmount && rideAmount < promo.minRideAmount) return 0;
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return 0;

    let discount = 0;

    if (promo.type === 'percentage') {
      discount = rideAmount * (promo.value / 100);
    } else if (promo.type === 'fixed' || promo.type === 'referral') {
      discount = promo.value;
    }

    // Cap at max discount
    if (promo.maxDiscount) {
      discount = Math.min(discount, promo.maxDiscount);
    }

    // Discount can't exceed ride amount
    return Math.min(discount, rideAmount);
  }

  /**
   * Record that a promo was applied
   */
  async recordAppliedPromo(code: string, rideId: string, discount: number): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(APPLIED_PROMOS_KEY);
      const history: Array<{ code: string; rideId: string; discount: number; appliedAt: string }> =
        raw ? JSON.parse(raw) : [];

      history.push({
        code,
        rideId,
        discount,
        appliedAt: new Date().toISOString(),
      });

      // Keep last 50
      await AsyncStorage.setItem(APPLIED_PROMOS_KEY, JSON.stringify(history.slice(-50)));
    } catch (error) {
      log.warn('Failed to record promo', { error: String(error) });
    }
  }

  /**
   * Generate or retrieve user's personal referral code
   */
  async getMyReferralCode(userId: string): Promise<string> {
    try {
      let code = await AsyncStorage.getItem(REFERRAL_CODE_KEY);
      if (code) return code;

      // Generate a code from userId
      const hash = userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
      code = `ARYV-${hash}${Math.floor(Math.random() * 90 + 10)}`;
      await AsyncStorage.setItem(REFERRAL_CODE_KEY, code);
      return code;
    } catch {
      return `ARYV-REF${Math.floor(Math.random() * 9000 + 1000)}`;
    }
  }

  /**
   * Get applied promos history
   */
  async getPromoHistory(): Promise<Array<{ code: string; rideId: string; discount: number; appliedAt: string }>> {
    try {
      const raw = await AsyncStorage.getItem(APPLIED_PROMOS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Local demo promo codes for testing
   */
  private checkLocalPromos(code: string): PromoCode | null {
    const localPromos: Record<string, PromoCode> = {
      'WELCOME50': {
        code: 'WELCOME50',
        type: 'percentage',
        value: 50,
        description: '50% off your first ride',
        maxDiscount: 100,
        isActive: true,
      },
      'ARYV2026': {
        code: 'ARYV2026',
        type: 'fixed',
        value: 20,
        currency: 'BWP',
        description: 'BWP 20 off any ride',
        isActive: true,
      },
      'FREERIDE': {
        code: 'FREERIDE',
        type: 'percentage',
        value: 100,
        description: 'Free ride (up to BWP 50)',
        maxDiscount: 50,
        isActive: true,
      },
    };

    return localPromos[code] || null;
  }
}

export default PromoCodeService;
