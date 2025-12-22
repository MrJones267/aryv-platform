/**
 * @fileoverview Currency Service for mobile app API communication
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { ApiClient } from './ApiClient';

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  flag?: string;
  countryCode?: string;
  exchangeRate: number;
  lastUpdated: string;
}

export interface CurrencyPreferences {
  primaryCurrency: Currency;
  availableCurrencies: Currency[];
  paymentCurrencies: Currency[];
}

export interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  exchangeRate: number;
  timestamp: string;
}

export interface PopularCurrenciesResponse {
  success: boolean;
  data: {
    currencies: Currency[];
    region: string;
    total: number;
  };
}

export interface ConversionRequest {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
}

export class CurrencyService {
  private static apiClient = new ApiClient();

  /**
   * Get all available currencies
   */
  static async getAllCurrencies(): Promise<Currency[]> {
    try {
      const response = await this.apiClient.get('/currencies');
      
      if (response.success) {
        return response.data.currencies;
      } else {
        console.error('Failed to fetch currencies:', response.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching currencies:', error);
      return [];
    }
  }

  /**
   * Get popular currencies by region
   */
  static async getPopularCurrencies(region: string = 'global'): Promise<Currency[]> {
    try {
      const response = await this.apiClient.get(`/currencies/popular?region=${region}`);
      
      if (response.success) {
        return response.data.currencies;
      } else {
        console.error('Failed to fetch popular currencies:', response.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching popular currencies:', error);
      return [];
    }
  }

  /**
   * Get user's currency preferences
   */
  static async getUserCurrencies(): Promise<CurrencyPreferences | null> {
    try {
      const response = await this.apiClient.get('/currencies/user');
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Failed to fetch user currencies:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user currencies:', error);
      return null;
    }
  }

  /**
   * Set user's primary currency
   */
  static async setPrimaryCurrency(currencyCode: string): Promise<boolean> {
    try {
      const response = await this.apiClient.put('/currencies/user/primary', {
        currencyCode: currencyCode.toUpperCase()
      });
      
      return response.success;
    } catch (error) {
      console.error('Error setting primary currency:', error);
      return false;
    }
  }

  /**
   * Add payment currency for user
   */
  static async addPaymentCurrency(currencyCode: string): Promise<boolean> {
    try {
      const response = await this.apiClient.post('/currencies/user/payment', {
        currencyCode: currencyCode.toUpperCase()
      });
      
      return response.success;
    } catch (error) {
      console.error('Error adding payment currency:', error);
      return false;
    }
  }

  /**
   * Remove payment currency for user
   */
  static async removePaymentCurrency(currencyCode: string): Promise<boolean> {
    try {
      const response = await this.apiClient.delete(`/currencies/user/payment/${currencyCode.toUpperCase()}`);
      
      return response.success;
    } catch (error) {
      console.error('Error removing payment currency:', error);
      return false;
    }
  }

  /**
   * Convert currency amount
   */
  static async convertCurrency(request: ConversionRequest): Promise<CurrencyConversion | null> {
    try {
      const response = await this.apiClient.post('/currencies/convert', {
        fromCurrency: request.fromCurrency.toUpperCase(),
        toCurrency: request.toCurrency.toUpperCase(),
        amount: request.amount
      });
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Currency conversion failed:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error converting currency:', error);
      return null;
    }
  }

  /**
   * Format amount according to currency
   */
  static formatAmount(amount: number, currency: Currency): string {
    try {
      const formatter = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: currency.decimalPlaces,
        maximumFractionDigits: currency.decimalPlaces,
      });
      
      return `${currency.symbol}${formatter.format(amount)}`;
    } catch (error) {
      console.error('Error formatting amount:', error);
      return `${currency.symbol}${amount.toFixed(currency.decimalPlaces)}`;
    }
  }

  /**
   * Get currency by code from cache or API
   */
  static async getCurrencyByCode(code: string): Promise<Currency | null> {
    try {
      const currencies = await this.getAllCurrencies();
      return currencies.find(c => c.code === code.toUpperCase()) || null;
    } catch (error) {
      console.error('Error getting currency by code:', error);
      return null;
    }
  }

  /**
   * Calculate conversion with cached rates
   */
  static calculateConversion(
    amount: number, 
    fromCurrency: Currency, 
    toCurrency: Currency
  ): number {
    try {
      if (fromCurrency.code === toCurrency.code) {
        return amount;
      }

      // Convert via USD as base currency
      const usdAmount = amount / fromCurrency.exchangeRate;
      const convertedAmount = usdAmount * toCurrency.exchangeRate;
      
      return parseFloat(convertedAmount.toFixed(toCurrency.decimalPlaces));
    } catch (error) {
      console.error('Error calculating conversion:', error);
      return amount;
    }
  }

  /**
   * Get user's region based on locale
   */
  static getUserRegion(): string {
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      const country = locale.split('-')[1];
      
      const regionMap: Record<string, string> = {
        'US': 'north-america',
        'CA': 'north-america', 
        'MX': 'north-america',
        'GB': 'europe',
        'DE': 'europe',
        'FR': 'europe',
        'IT': 'europe',
        'ES': 'europe',
        'JP': 'asia',
        'CN': 'asia',
        'IN': 'asia',
        'KR': 'asia',
        'AU': 'oceania',
        'NZ': 'oceania',
        'BR': 'south-america',
        'AR': 'south-america',
        'ZA': 'africa',
        'NG': 'africa',
        'KE': 'africa',
        'EG': 'africa',
      };

      return regionMap[country] || 'global';
    } catch (error) {
      console.error('Error getting user region:', error);
      return 'global';
    }
  }

  /**
   * Validate currency conversion limits
   */
  static validateConversionAmount(amount: number): { isValid: boolean; message?: string } {
    const maxAmount = 10000;
    const minAmount = 0.01;

    if (amount < minAmount) {
      return { 
        isValid: false, 
        message: 'Amount too small for conversion' 
      };
    }

    if (amount > maxAmount) {
      return { 
        isValid: false, 
        message: 'Amount exceeds maximum conversion limit' 
      };
    }

    return { isValid: true };
  }

  /**
   * Get currency flag emoji
   */
  static getCurrencyFlag(countryCode?: string): string {
    if (!countryCode) return '🌍';
    
    const flagMap: Record<string, string> = {
      'US': '🇺🇸',
      'EU': '🇪🇺',
      'GB': '🇬🇧',
      'JP': '🇯🇵',
      'CA': '🇨🇦',
      'AU': '🇦🇺',
      'CH': '🇨🇭',
      'CN': '🇨🇳',
      'IN': '🇮🇳',
      'BR': '🇧🇷',
      'MX': '🇲🇽',
      'ZA': '🇿🇦',
      'NG': '🇳🇬',
      'KE': '🇰🇪',
      'EG': '🇪🇬',
    };

    return flagMap[countryCode.toUpperCase()] || '🌍';
  }

  /**
   * Cache currencies locally for offline use
   */
  private static currencyCache: Currency[] = [];
  private static cacheTimestamp = 0;
  private static CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

  static async getCachedCurrencies(): Promise<Currency[]> {
    const now = Date.now();
    
    if (this.currencyCache.length === 0 || (now - this.cacheTimestamp) > this.CACHE_DURATION) {
      this.currencyCache = await this.getAllCurrencies();
      this.cacheTimestamp = now;
    }
    
    return this.currencyCache;
  }
}

export default CurrencyService;