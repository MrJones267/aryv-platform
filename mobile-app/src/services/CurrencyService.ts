/**
 * @fileoverview Currency Service for mobile app API communication
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { ApiClient } from './ApiClient';
import logger from './LoggingService';

const log = logger.createLogger('CurrencyService');

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
  
  // Fallback currency data for offline/error scenarios
  private static fallbackCurrencies: Currency[] = [
    // SADC / Southern African currencies (primary)
    {
      id: '1',
      code: 'BWP',
      name: 'Botswana Pula',
      symbol: 'P',
      decimalPlaces: 2,
      flag: '🇧🇼',
      countryCode: 'BW',
      exchangeRate: 13.6,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '2',
      code: 'ZAR',
      name: 'South African Rand',
      symbol: 'R',
      decimalPlaces: 2,
      flag: '🇿🇦',
      countryCode: 'ZA',
      exchangeRate: 18.5,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '3',
      code: 'NAD',
      name: 'Namibian Dollar',
      symbol: 'N$',
      decimalPlaces: 2,
      flag: '🇳🇦',
      countryCode: 'NA',
      exchangeRate: 18.5,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '4',
      code: 'ZMW',
      name: 'Zambian Kwacha',
      symbol: 'ZK',
      decimalPlaces: 2,
      flag: '🇿🇲',
      countryCode: 'ZM',
      exchangeRate: 27.0,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '5',
      code: 'MZN',
      name: 'Mozambican Metical',
      symbol: 'MT',
      decimalPlaces: 2,
      flag: '🇲🇿',
      countryCode: 'MZ',
      exchangeRate: 63.9,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '6',
      code: 'MWK',
      name: 'Malawian Kwacha',
      symbol: 'MK',
      decimalPlaces: 2,
      flag: '🇲🇼',
      countryCode: 'MW',
      exchangeRate: 1735.0,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '7',
      code: 'SZL',
      name: 'Eswatini Lilangeni',
      symbol: 'E',
      decimalPlaces: 2,
      flag: '🇸🇿',
      countryCode: 'SZ',
      exchangeRate: 18.5,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '8',
      code: 'LSL',
      name: 'Lesotho Loti',
      symbol: 'L',
      decimalPlaces: 2,
      flag: '🇱🇸',
      countryCode: 'LS',
      exchangeRate: 18.5,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '9',
      code: 'ZWL',
      name: 'Zimbabwean Dollar',
      symbol: 'Z$',
      decimalPlaces: 2,
      flag: '🇿🇼',
      countryCode: 'ZW',
      exchangeRate: 4500.0,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '10',
      code: 'AOA',
      name: 'Angolan Kwanza',
      symbol: 'Kz',
      decimalPlaces: 2,
      flag: '🇦🇴',
      countryCode: 'AO',
      exchangeRate: 830.0,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '11',
      code: 'TZS',
      name: 'Tanzanian Shilling',
      symbol: 'TSh',
      decimalPlaces: 2,
      flag: '🇹🇿',
      countryCode: 'TZ',
      exchangeRate: 2650.0,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '12',
      code: 'CDF',
      name: 'Congolese Franc',
      symbol: 'FC',
      decimalPlaces: 2,
      flag: '🇨🇩',
      countryCode: 'CD',
      exchangeRate: 2780.0,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '13',
      code: 'MGA',
      name: 'Malagasy Ariary',
      symbol: 'Ar',
      decimalPlaces: 2,
      flag: '🇲🇬',
      countryCode: 'MG',
      exchangeRate: 4550.0,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '14',
      code: 'MUR',
      name: 'Mauritian Rupee',
      symbol: '₨',
      decimalPlaces: 2,
      flag: '🇲🇺',
      countryCode: 'MU',
      exchangeRate: 45.5,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '15',
      code: 'SCR',
      name: 'Seychellois Rupee',
      symbol: '₨',
      decimalPlaces: 2,
      flag: '🇸🇨',
      countryCode: 'SC',
      exchangeRate: 14.2,
      lastUpdated: new Date().toISOString()
    },
    // Other African currencies
    {
      id: '16',
      code: 'KES',
      name: 'Kenyan Shilling',
      symbol: 'KSh',
      decimalPlaces: 2,
      flag: '🇰🇪',
      countryCode: 'KE',
      exchangeRate: 129.5,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '17',
      code: 'NGN',
      name: 'Nigerian Naira',
      symbol: '₦',
      decimalPlaces: 2,
      flag: '🇳🇬',
      countryCode: 'NG',
      exchangeRate: 760.0,
      lastUpdated: new Date().toISOString()
    },
    // International currencies
    {
      id: '18',
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimalPlaces: 2,
      flag: '🇺🇸',
      countryCode: 'US',
      exchangeRate: 1.0,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '19',
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      decimalPlaces: 2,
      flag: '🇪🇺',
      countryCode: 'EU',
      exchangeRate: 0.85,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '20',
      code: 'GBP',
      name: 'British Pound',
      symbol: '£',
      decimalPlaces: 2,
      flag: '🇬🇧',
      countryCode: 'GB',
      exchangeRate: 0.73,
      lastUpdated: new Date().toISOString()
    },
  ];

  /**
   * Get all available currencies
   */
  static async getAllCurrencies(): Promise<Currency[]> {
    try {
      const response = await this.apiClient.get('/currencies');
      
      if (response.success && response.data?.currencies) {
        return response.data.currencies;
      } else {
        log.warn('API currencies not available, using fallback data');
        return this.fallbackCurrencies;
      }
    } catch (error) {
      log.warn('Error fetching currencies, using fallback data', error);
      return this.fallbackCurrencies;
    }
  }

  /**
   * Get popular currencies by region
   */
  static async getPopularCurrencies(region: string = 'global'): Promise<Currency[]> {
    try {
      const response = await this.apiClient.get(`/currencies/popular?region=${region}`);
      
      if (response.success && response.data?.currencies) {
        return response.data.currencies;
      } else {
        log.warn('API popular currencies not available, using fallback data');
        // Return most popular currencies as fallback
        return this.fallbackCurrencies.slice(0, 6);
      }
    } catch (error) {
      log.warn('Error fetching popular currencies, using fallback data', error);
      return this.fallbackCurrencies.slice(0, 6);
    }
  }

  /**
   * Get user's currency preferences
   */
  static async getUserCurrencies(): Promise<CurrencyPreferences | null> {
    try {
      const response = await this.apiClient.get('/currencies/user');
      
      if (response.success && response.data) {
        return response.data;
      } else {
        log.warn('API user currencies not available, creating default preferences');
        return this.createDefaultCurrencyPreferences();
      }
    } catch (error) {
      log.warn('Error fetching user currencies, creating default preferences', error);
      return this.createDefaultCurrencyPreferences();
    }
  }

  /**
   * Create default currency preferences for new users
   */
  private static createDefaultCurrencyPreferences(): CurrencyPreferences {
    const defaultCurrency = this.fallbackCurrencies.find(c => c.code === 'BWP') || this.fallbackCurrencies[0];

    return {
      primaryCurrency: defaultCurrency,
      availableCurrencies: this.fallbackCurrencies,
      paymentCurrencies: [defaultCurrency]
    };
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
      log.error('Error setting primary currency', error);
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
      log.error('Error adding payment currency', error);
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
      log.error('Error removing payment currency:', error);
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
        log.error('Currency conversion failed:', response.error);
        return null;
      }
    } catch (error) {
      log.error('Error converting currency:', error);
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
      log.error('Error formatting amount:', error);
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
      log.error('Error getting currency by code:', error);
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
      log.error('Error calculating conversion:', error);
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
        // SADC / Southern Africa
        'BW': 'africa',
        'ZA': 'africa',
        'NA': 'africa',
        'ZM': 'africa',
        'MZ': 'africa',
        'MW': 'africa',
        'SZ': 'africa',
        'LS': 'africa',
        'ZW': 'africa',
        'AO': 'africa',
        'TZ': 'africa',
        'CD': 'africa',
        'MG': 'africa',
        'MU': 'africa',
        'SC': 'africa',
        'NG': 'africa',
        'KE': 'africa',
        'EG': 'africa',
        'GH': 'africa',
        // Americas
        'US': 'north-america',
        'CA': 'north-america',
        'MX': 'north-america',
        'BR': 'south-america',
        'AR': 'south-america',
        // Europe
        'GB': 'europe',
        'DE': 'europe',
        'FR': 'europe',
        'IT': 'europe',
        'ES': 'europe',
        // Asia
        'JP': 'asia',
        'CN': 'asia',
        'IN': 'asia',
        'KR': 'asia',
        // Oceania
        'AU': 'oceania',
        'NZ': 'oceania',
      };

      return regionMap[country] || 'global';
    } catch (error) {
      log.error('Error getting user region:', error);
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
      // SADC countries
      'BW': '🇧🇼',
      'ZA': '🇿🇦',
      'NA': '🇳🇦',
      'ZM': '🇿🇲',
      'MZ': '🇲🇿',
      'MW': '🇲🇼',
      'SZ': '🇸🇿',
      'LS': '🇱🇸',
      'ZW': '🇿🇼',
      'AO': '🇦🇴',
      'TZ': '🇹🇿',
      'CD': '🇨🇩',
      'MG': '🇲🇬',
      'MU': '🇲🇺',
      'SC': '🇸🇨',
      // Other African
      'NG': '🇳🇬',
      'KE': '🇰🇪',
      'EG': '🇪🇬',
      'GH': '🇬🇭',
      // International
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
    };

    return flagMap[countryCode.toUpperCase()] || '🌍';
  }

  /**
   * Get currencies by country code
   */
  static async getCurrenciesByCountry(countryCode: string): Promise<Currency[]> {
    try {
      const response = await this.apiClient.get(`/currencies/country/${countryCode}`);
      
      if (response.success) {
        return response.data.currencies;
      } else {
        log.error('Failed to fetch currencies for country:', response.error);
        
        // Fallback to common country-currency mappings (SADC + international)
        const countryToCurrency: Record<string, Currency[]> = {
          'BW': [{ id: 'bwp', code: 'BWP', name: 'Botswana Pula', symbol: 'P', decimalPlaces: 2, exchangeRate: 13.6, lastUpdated: new Date().toISOString() }],
          'ZA': [{ id: 'zar', code: 'ZAR', name: 'South African Rand', symbol: 'R', decimalPlaces: 2, exchangeRate: 18.5, lastUpdated: new Date().toISOString() }],
          'NA': [{ id: 'nad', code: 'NAD', name: 'Namibian Dollar', symbol: 'N$', decimalPlaces: 2, exchangeRate: 18.5, lastUpdated: new Date().toISOString() }],
          'ZM': [{ id: 'zmw', code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', decimalPlaces: 2, exchangeRate: 27, lastUpdated: new Date().toISOString() }],
          'MZ': [{ id: 'mzn', code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', decimalPlaces: 2, exchangeRate: 63.9, lastUpdated: new Date().toISOString() }],
          'MW': [{ id: 'mwk', code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK', decimalPlaces: 2, exchangeRate: 1735, lastUpdated: new Date().toISOString() }],
          'SZ': [{ id: 'szl', code: 'SZL', name: 'Eswatini Lilangeni', symbol: 'E', decimalPlaces: 2, exchangeRate: 18.5, lastUpdated: new Date().toISOString() }],
          'LS': [{ id: 'lsl', code: 'LSL', name: 'Lesotho Loti', symbol: 'L', decimalPlaces: 2, exchangeRate: 18.5, lastUpdated: new Date().toISOString() }],
          'ZW': [{ id: 'zwl', code: 'ZWL', name: 'Zimbabwean Dollar', symbol: 'Z$', decimalPlaces: 2, exchangeRate: 4500, lastUpdated: new Date().toISOString() }],
          'AO': [{ id: 'aoa', code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz', decimalPlaces: 2, exchangeRate: 830, lastUpdated: new Date().toISOString() }],
          'TZ': [{ id: 'tzs', code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', decimalPlaces: 2, exchangeRate: 2650, lastUpdated: new Date().toISOString() }],
          'CD': [{ id: 'cdf', code: 'CDF', name: 'Congolese Franc', symbol: 'FC', decimalPlaces: 2, exchangeRate: 2780, lastUpdated: new Date().toISOString() }],
          'MG': [{ id: 'mga', code: 'MGA', name: 'Malagasy Ariary', symbol: 'Ar', decimalPlaces: 2, exchangeRate: 4550, lastUpdated: new Date().toISOString() }],
          'MU': [{ id: 'mur', code: 'MUR', name: 'Mauritian Rupee', symbol: '₨', decimalPlaces: 2, exchangeRate: 45.5, lastUpdated: new Date().toISOString() }],
          'SC': [{ id: 'scr', code: 'SCR', name: 'Seychellois Rupee', symbol: '₨', decimalPlaces: 2, exchangeRate: 14.2, lastUpdated: new Date().toISOString() }],
          'KE': [{ id: 'kes', code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimalPlaces: 2, exchangeRate: 130, lastUpdated: new Date().toISOString() }],
          'NG': [{ id: 'ngn', code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimalPlaces: 2, exchangeRate: 800, lastUpdated: new Date().toISOString() }],
          'US': [{ id: 'usd', code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2, exchangeRate: 1, lastUpdated: new Date().toISOString() }],
          'GB': [{ id: 'gbp', code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2, exchangeRate: 0.8, lastUpdated: new Date().toISOString() }],
        };

        return countryToCurrency[countryCode] || [countryToCurrency['BWP']?.[0] || countryToCurrency['US'][0]];
      }
    } catch (error) {
      log.error('Error fetching currencies by country:', error);
      // Return USD as fallback
      return [{ id: 'usd', code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2, exchangeRate: 1, lastUpdated: new Date().toISOString() }];
    }
  }

  /**
   * Set user's preferred currency
   */
  static async setUserCurrency(currencyCode: string): Promise<boolean> {
    try {
      const response = await this.apiClient.post('/users/currency', {
        currency: currencyCode.toUpperCase()
      });
      
      if (response.success) {
        log.info('User currency updated successfully:', currencyCode);
        return true;
      } else {
        log.error('Failed to update user currency:', response.error);
        return false;
      }
    } catch (error) {
      log.error('Error setting user currency:', error);
      return false;
    }
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