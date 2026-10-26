/**
 * @fileoverview Currency Service for exchange rates and currency management
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Currency } from '../models/Currency';
import { UserCurrency } from '../models/UserCurrency';
import axios from 'axios';
import logger from '../utils/logger';

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

/**
 * The platform's home currency. ARYV operates from Botswana, and several
 * places in the codebase already assume BWP — settings defaults, promo copy,
 * payment fallbacks — so this makes that assumption explicit in one place.
 */
export const PLATFORM_DEFAULT_CURRENCY = 'BWP';

/**
 * Country to currency for the region ARYV serves. Only currencies that are
 * actually seeded belong here: an unseeded code falls through to the platform
 * default rather than leaving the user with none.
 */
export const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  BW: 'BWP', // Botswana
  ZA: 'ZAR', // South Africa
  NA: 'NAD', // Namibia
  ZM: 'ZMW', // Zambia
  ZW: 'ZWL', // Zimbabwe
  SZ: 'SZL', // Eswatini
  LS: 'LSL', // Lesotho
  MW: 'MWK', // Malawi
  MZ: 'MZN', // Mozambique
  AO: 'AOA', // Angola
  TZ: 'TZS', // Tanzania
  US: 'USD',
};

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
      ...(process.env['FIXER_API_KEY'] && { apiKey: process.env['FIXER_API_KEY'] }),
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
      logger.error('Error fetching active currencies', { error: (error as Error).message });
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
      logger.error('Error fetching currency', { code, error: (error as Error).message });
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
        // Seed a default from where the user actually is. Defaulting everyone
        // to USD quoted Botswana riders their fares in dollars.
        const seeded = await this.seedDefaultCurrency(userId);
        if (!seeded) {
          throw new Error('Could not establish a default currency for this user');
        }

        // Re-read once, never in a loop. The previous version recursed on
        // failure, so a missing currency row meant unbounded recursion rather
        // than an error.
        return this.readUserCurrencies(userId);
      }

      const primaryCurrency = userCurrencies.find(uc => uc.isPrimary)?.currency
        ?? userCurrencies[0]!.currency!;
      const availableCurrencies = await this.getActiveCurrencies();
      const paymentCurrencies = userCurrencies
        .filter(uc => uc.isPaymentEnabled)
        .map(uc => uc.currency!);

      return {
        primaryCurrency,
        availableCurrencies,
        paymentCurrencies,
      };
    } catch (error) {
      logger.error('Error fetching user currencies', { error: (error as Error).message });
      throw new Error('Failed to fetch user currency preferences');
    }
  }

  /**
   * The ISO code a user's money should be denominated in.
   *
   * Never throws and always returns something: a money record must have a
   * currency, and refusing to create a booking because a preference lookup
   * failed would be worse than recording the platform default.
   */
  static async getUserCurrencyCode(userId: string): Promise<string> {
    try {
      const preferences = await this.getUserCurrencies(userId);
      return preferences?.primaryCurrency?.code ?? PLATFORM_DEFAULT_CURRENCY;
    } catch {
      return PLATFORM_DEFAULT_CURRENCY;
    }
  }

  /**
   * Read stored preferences without seeding. Used for the single retry after
   * a default is created, so that path cannot loop.
   */
  private static async readUserCurrencies(userId: string): Promise<CurrencyPreferences> {
    const userCurrencies = await UserCurrency.findAll({
      where: { userId },
      include: [{ model: Currency, as: 'currency', where: { isActive: true } }],
      order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']],
    });

    if (userCurrencies.length === 0) {
      throw new Error('Could not establish a default currency for this user');
    }

    const primaryCurrency = userCurrencies.find((uc) => uc.isPrimary)?.currency
      ?? userCurrencies[0]!.currency!;

    return {
      primaryCurrency,
      availableCurrencies: await this.getActiveCurrencies(),
      paymentCurrencies: userCurrencies.filter((uc) => uc.isPaymentEnabled).map((uc) => uc.currency!),
    };
  }

  /**
   * Choose a starting currency for a user who has never set one: the currency
   * of their country if we know it and support it, otherwise the platform
   * default, otherwise USD.
   */
  private static async seedDefaultCurrency(userId: string): Promise<boolean> {
    const { default: User } = await import('../models/User');
    const user = await User.findByPk(userId);
    const countryCode = (user as unknown as { countryCode?: string })?.countryCode;

    const candidates = [
      countryCode ? COUNTRY_DEFAULT_CURRENCY[countryCode.toUpperCase()] : undefined,
      PLATFORM_DEFAULT_CURRENCY,
      'USD',
    ].filter((code): code is string => Boolean(code));

    for (const code of candidates) {
      if (await this.setUserPrimaryCurrency(userId, code)) {
        logger.info('Seeded default currency for user', { userId, code, countryCode });
        return true;
      }
    }

    logger.error('No usable default currency could be set', { userId, countryCode });
    return false;
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
      logger.error('Error setting primary currency', { error: (error as Error).message });
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
      logger.error('Error adding payment currency', { error: (error as Error).message });
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
      logger.error('Error converting currency', { error: (error as Error).message });
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
      logger.error('Error updating exchange rates', { error: (error as Error).message });
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
      logger.error('Error fetching from exchange rate provider', { provider: provider.name, error: (error as Error).message });
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
      logger.error('Error updating currency rates', { error: (error as Error).message });
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
      logger.error('Error formatting amount', { error: (error as Error).message });
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
