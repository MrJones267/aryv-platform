/**
 * @fileoverview Currency Service for exchange rates and currency management
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Currency } from '../models/Currency';
import { UserCurrency } from '../models/UserCurrency';
import axios from 'axios';

export interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  exchangeRate: number;
  timestamp: Date;
}

export interface CurrencyPreferences {
  primaryCurrency: Currency;
  availableCurrencies: Currency[];
  paymentCurrencies: Currency[];
}

export interface ExchangeRateProvider {
  name: string;
  url: string;
  apiKey?: string;
  isActive: boolean;
}

export class CurrencyService {
  private static exchangeProviders: ExchangeRateProvider[] = [
    {
      name: 'exchangerate-api',
      url: 'https://api.exchangerate-api.com/v4/latest',
      isActive: true,
    },
    {
      name: 'fixer',
      url: 'http://data.fixer.io/api/latest',
      apiKey: process.env['FIXER_API_KEY'] || 'default-key',
      isActive: false,
    },
  ];

  /**
   * Get all active currencies
   */
  static async getActiveCurrencies(): Promise<Currency[]> {
    try {
      return await Currency.findAll({
        where: { isActive: true },
        order: [['code', 'ASC']],
      });
    } catch (error) {
      console.error('Error fetching active currencies:', error);
      throw new Error('Failed to fetch currencies');
    }
  }

  /**
   * Get currency by code
   */
  static async getCurrencyByCode(code: string): Promise<Currency | null> {
    try {
      return await Currency.findOne({
        where: {
          code: code.toUpperCase(),
          isActive: true,
        },
      });
    } catch (error) {
      console.error(`Error fetching currency ${code}:`, error);
      return null;
    }
  }

  /**
   * Get user's currency preferences
   */
  static async getUserCurrencies(userId: string): Promise<CurrencyPreferences> {
    try {
      const userCurrencies = await UserCurrency.findAll({
        where: { userId },
        include: [{
          model: Currency,
          as: 'currency',
          where: { isActive: true },
        }],
        order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']],
      });

      if (userCurrencies.length === 0) {
        // Set USD as default if no preferences exist
        await this.setUserPrimaryCurrency(userId, 'USD');
        return this.getUserCurrencies(userId);
      }

      const primaryCurrency = userCurrencies.find(uc => uc.isPrimary)?.Currency || userCurrencies[0].Currency!;
      const availableCurrencies = await this.getActiveCurrencies();
      const paymentCurrencies = userCurrencies
        .filter(uc => uc.isPaymentEnabled)
        .map(uc => uc.Currency!);

      return {
        primaryCurrency,
        availableCurrencies,
        paymentCurrencies,
      };
    } catch (error) {
      console.error('Error fetching user currencies:', error);
      throw new Error('Failed to fetch user currency preferences');
    }
  }

  /**
   * Set user's primary currency
   */
  static async setUserPrimaryCurrency(userId: string, currencyCode: string): Promise<boolean> {
    try {
      const currency = await this.getCurrencyByCode(currencyCode);
      if (!currency) {
        throw new Error(`Currency ${currencyCode} not found or inactive`);
      }

      // Create or update user currency preference
      const [_userCurrency, _created] = await UserCurrency.upsert({
        userId,
        currencyId: currency.id,
        isPrimary: true,
        isPaymentEnabled: true,
      });

      return true;
    } catch (error) {
      console.error('Error setting primary currency:', error);
      throw error;
    }
  }

  /**
   * Add currency to user's payment options
   */
  static async addUserPaymentCurrency(userId: string, currencyCode: string): Promise<boolean> {
    try {
      const currency = await this.getCurrencyByCode(currencyCode);
      if (!currency) {
        throw new Error(`Currency ${currencyCode} not found or inactive`);
      }

      await UserCurrency.upsert({
        userId,
        currencyId: currency.id,
        isPrimary: false,
        isPaymentEnabled: true,
      });

      return true;
    } catch (error) {
      console.error('Error adding payment currency:', error);
      throw error;
    }
  }

  /**
   * Convert amount between currencies
   */
  static async convertCurrency(
    fromCode: string,
    toCode: string,
    amount: number,
  ): Promise<CurrencyConversion> {
    try {
      const fromCurrency = await this.getCurrencyByCode(fromCode);
      const toCurrency = await this.getCurrencyByCode(toCode);

      if (!fromCurrency || !toCurrency) {
        throw new Error(`Invalid currency codes: ${fromCode} or ${toCode}`);
      }

      // If same currency, return original amount
      if (fromCode === toCode) {
        return {
          fromCurrency: fromCode,
          toCurrency: toCode,
          amount,
          convertedAmount: amount,
          exchangeRate: 1,
          timestamp: new Date(),
        };
      }

      // Convert via USD as base currency
      // From currency -> USD -> To currency
      const usdAmount = amount / fromCurrency.exchangeRate;
      const convertedAmount = parseFloat((usdAmount * toCurrency.exchangeRate).toFixed(toCurrency.decimalPlaces));
      const exchangeRate = toCurrency.exchangeRate / fromCurrency.exchangeRate;

      return {
        fromCurrency: fromCode,
        toCurrency: toCode,
        amount,
        convertedAmount,
        exchangeRate,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error converting currency:', error as Error);
      throw error;
    }
  }

  /**
   * Update exchange rates from external API
   */
  static async updateExchangeRates(): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    try {
      // Try each provider until one works
      for (const provider of this.exchangeProviders) {
        if (!provider.isActive) continue;

        try {
          const rates = await this.fetchRatesFromProvider(provider);
          if (rates) {
            updated = await this.updateCurrencyRates(rates);
            break;
          }
        } catch (error) {
          errors.push(`${provider.name}: ${(error as Error).message}`);
        }
      }

      return { updated, errors };
    } catch (error) {
      console.error('Error updating exchange rates:', error);
      errors.push(`General error: ${(error as Error).message}`);
      return { updated: 0, errors };
    }
  }

  /**
   * Fetch exchange rates from external provider
   */
  private static async fetchRatesFromProvider(provider: ExchangeRateProvider): Promise<Record<string, number> | null> {
    try {
      const url = provider.apiKey
        ? `${provider.url}?access_key=${provider.apiKey}&base=USD`
        : `${provider.url}/USD`;

      const response = await axios.get(url, { timeout: 10000 });

      if (response.data && response.data.rates) {
        return response.data.rates;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching from ${provider.name}:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * Update currency rates in database
   */
  private static async updateCurrencyRates(rates: Record<string, number>): Promise<number> {
    let updated = 0;

    try {
      const currencies = await Currency.findAll({ where: { isActive: true } });

      for (const currency of currencies) {
        if (currency.code === 'USD') continue; // USD is base currency

        const newRate = rates[currency.code];
        if (newRate && newRate > 0) {
          await currency.update({
            exchangeRate: newRate,
            lastUpdated: new Date(),
          });
          updated++;
        }
      }

      return updated;
    } catch (error) {
      console.error('Error updating currency rates:', error);
      throw error;
    }
  }

  /**
   * Format amount according to currency rules
   */
  static formatAmount(amount: number, currency: Currency | string): string {
    try {
      let currencyObj: Currency;

      if (typeof currency === 'string') {
        // This would require a synchronous lookup - better to pass Currency object
        return `${currency} ${amount.toFixed(2)}`;
      } else {
        currencyObj = currency;
      }

      return currencyObj.formatAmount(amount);
    } catch (error) {
      console.error('Error formatting amount:', error);
      return `${amount.toFixed(2)}`;
    }
  }

  /**
   * Get popular currencies by region
   */
  static getPopularCurrenciesByRegion(region: string): string[] {
    const popularCurrencies: Record<string, string[]> = {
      'north-america': ['USD', 'CAD', 'MXN'],
      'europe': ['EUR', 'GBP', 'CHF'],
      'asia': ['JPY', 'CNY', 'INR'],
      'africa': ['ZAR', 'NGN', 'KES', 'EGP'],
      'south-america': ['BRL', 'ARS', 'CLP'],
      'oceania': ['AUD', 'NZD'],
    };

    return popularCurrencies[region.toLowerCase()] || ['USD', 'EUR', 'GBP'];
  }

  /**
   * Validate currency conversion limits
   */
  static validateConversionLimits(_fromCode: string, amount: number): { isValid: boolean; reason?: string } {
    // Define conversion limits to prevent abuse
    const maxConversionAmount = 10000; // Max $10,000 USD equivalent
    const minConversionAmount = 0.01;

    if (amount < minConversionAmount) {
      return { isValid: false, reason: 'Amount too small for conversion' };
    }

    if (amount > maxConversionAmount) {
      return { isValid: false, reason: 'Amount exceeds conversion limit' };
    }

    return { isValid: true };
  }
}

export default CurrencyService;
