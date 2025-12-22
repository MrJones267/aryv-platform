/**
 * @fileoverview Country Service for managing country data and user location preferences
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Country } from '../models/Country';
import User from '../models/User';
import { CurrencyService } from './CurrencyService';

export interface CountryWithCurrencies extends Country {
  suggestedCurrencies?: Array<{
    code: string;
    name: string;
    symbol: string;
    isPrimary?: boolean;
  }>;
}

export interface CountrySelectionResult {
  country: Country;
  suggestedCurrency?: string;
  suggestedTimezone?: string;
  suggestedLanguage?: string;
}

export class CountryService {

  /**
   * Get all active countries
   */
  static async getAllCountries(): Promise<Country[]> {
    try {
      return await Country.findAll({
        where: { isActive: true },
        order: [['name', 'ASC']],
      });
    } catch (error) {
      console.error('Error fetching countries:', error);
      throw new Error('Failed to fetch countries');
    }
  }

  /**
   * Get countries by continent or region
   */
  static async getCountriesByRegion(region: string): Promise<Country[]> {
    try {
      const normalizedRegion = region.toLowerCase();

      return await Country.findAll({
        where: {
          isActive: true,
        },
        order: [['name', 'ASC']],
      }).then(countries =>
        countries.filter(country =>
          country.continent.toLowerCase().includes(normalizedRegion) ||
          country.region.toLowerCase().includes(normalizedRegion) ||
          country.subRegion?.toLowerCase().includes(normalizedRegion),
        ),
      );
    } catch (error) {
      console.error('Error fetching countries by region:', error);
      throw new Error('Failed to fetch countries by region');
    }
  }

  /**
   * Get popular countries for ride-sharing services
   */
  static async getPopularCountries(): Promise<Country[]> {
    try {
      const popularCountryCodes = [
        'US', 'CA', 'GB', 'DE', 'FR', 'AU', 'JP', 'SG', 'IN', 'BR',
        'MX', 'ES', 'IT', 'NL', 'KR', 'TH', 'MY', 'ZA', 'AE', 'PH',
      ];

      return await Country.findAll({
        where: {
          code: popularCountryCodes,
          isActive: true,
        },
        order: [['name', 'ASC']],
      });
    } catch (error) {
      console.error('Error fetching popular countries:', error);
      throw new Error('Failed to fetch popular countries');
    }
  }

  /**
   * Get country by code
   */
  static async getCountryByCode(code: string): Promise<Country | null> {
    try {
      return await Country.findOne({
        where: {
          code: code.toUpperCase(),
          isActive: true,
        },
      });
    } catch (error) {
      console.error(`Error fetching country ${code}:`, error);
      return null;
    }
  }

  /**
   * Set user's country of operation
   */
  static async setUserCountry(
    userId: string,
    countryCode: string,
    updateCurrency: boolean = true,
  ): Promise<CountrySelectionResult | null> {
    try {
      const country = await this.getCountryByCode(countryCode);
      if (!country) {
        throw new Error(`Country with code ${countryCode} not found`);
      }

      // Update user's country information
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await user.update({
        countryCode: country.code,
        countryName: country.name,
        timezone: country.getPrimaryTimezone(),
      });

      const result: CountrySelectionResult = {
        country,
        suggestedTimezone: country.getPrimaryTimezone(),
        suggestedLanguage: country.getPrimaryLanguage(),
      };

      // Auto-suggest currency based on country
      if (updateCurrency) {
        const suggestedCurrency = await this.getSuggestedCurrency(country.code);
        if (suggestedCurrency) {
          result.suggestedCurrency = suggestedCurrency.code;

          // Automatically set as primary currency if user doesn't have one set
          try {
            const userPreferences = await CurrencyService.getUserCurrencies(userId);
            if (!userPreferences.primaryCurrency || userPreferences.primaryCurrency.code === 'USD') {
              await CurrencyService.setUserPrimaryCurrency(userId, suggestedCurrency.code);
            }
          } catch (error) {
            console.warn('Could not auto-update user currency:', error);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Error setting user country:', error);
      throw error;
    }
  }

  /**
   * Get suggested currency for a country
   */
  static async getSuggestedCurrency(countryCode: string): Promise<{ code: string; name: string; symbol: string } | null> {
    try {
      // Mapping of country codes to their primary currencies
      const countryToCurrency: Record<string, string> = {
        'US': 'USD', 'CA': 'CAD', 'MX': 'MXN',
        'GB': 'GBP', 'EU': 'EUR', 'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'NL': 'EUR',
        'CH': 'CHF', 'SE': 'SEK', 'NO': 'NOK',
        'JP': 'JPY', 'KR': 'KRW', 'CN': 'CNY', 'IN': 'INR', 'SG': 'SGD',
        'AU': 'AUD', 'NZ': 'NZD',
        'BR': 'BRL', 'AR': 'ARS', 'CL': 'CLP', 'CO': 'COP', 'PE': 'PEN',
        'ZA': 'ZAR', 'NG': 'NGN', 'KE': 'KES', 'EG': 'EGP', 'MA': 'MAD', 'GH': 'GHS',
        'AE': 'AED', 'SA': 'SAR', 'TR': 'TRY',
        'TH': 'THB', 'VN': 'VND', 'MY': 'MYR', 'ID': 'IDR', 'PH': 'PHP',
      };

      const currencyCode = countryToCurrency[countryCode.toUpperCase()];
      if (!currencyCode) {
        return null; // Default to user's existing currency
      }

      const currency = await CurrencyService.getCurrencyByCode(currencyCode);
      if (!currency) {
        return null;
      }

      return {
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
      };
    } catch (error) {
      console.error('Error getting suggested currency:', error);
      return null;
    }
  }

  /**
   * Get countries with their suggested currencies
   */
  static async getCountriesWithCurrencies(): Promise<CountryWithCurrencies[]> {
    try {
      const countries = await this.getAllCountries();
      const result: CountryWithCurrencies[] = [];

      for (const country of countries) {
        const suggestedCurrency = await this.getSuggestedCurrency(country.code);
        const countryWithCurrency: CountryWithCurrencies = {
          ...country.toJSON(),
          suggestedCurrencies: suggestedCurrency ? [{
            code: suggestedCurrency.code,
            name: suggestedCurrency.name,
            symbol: suggestedCurrency.symbol,
            isPrimary: true,
          }] : undefined,
        } as CountryWithCurrencies;

        result.push(countryWithCurrency);
      }

      return result;
    } catch (error) {
      console.error('Error fetching countries with currencies:', error);
      throw new Error('Failed to fetch countries with currencies');
    }
  }

  /**
   * Get user's country information
   */
  static async getUserCountry(userId: string): Promise<{
    country: Country | null;
    timezone: string | null;
  }> {
    try {
      const user = await User.findByPk(userId);
      if (!user || !user.countryCode) {
        return { country: null, timezone: null };
      }

      const country = await this.getCountryByCode(user.countryCode);
      return {
        country,
        timezone: user.timezone,
      };
    } catch (error) {
      console.error('Error fetching user country:', error);
      return { country: null, timezone: null };
    }
  }

  /**
   * Suggest countries based on phone number prefix
   */
  static async getCountriesByPhonePrefix(phoneNumber: string): Promise<Country[]> {
    try {
      // Extract potential country code from phone number
      const cleanPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits

      if (!cleanPhone.startsWith('1') && cleanPhone.length < 7) {
        return [];
      }

      // Try different prefix lengths (1-4 digits)
      const possiblePrefixes = [];
      for (let i = 1; i <= Math.min(4, cleanPhone.length); i++) {
        possiblePrefixes.push(`+${cleanPhone.substring(0, i)}`);
      }

      return await Country.findAll({
        where: {
          phonePrefix: possiblePrefixes,
          isActive: true,
        },
        order: [['name', 'ASC']],
      });
    } catch (error) {
      console.error('Error getting countries by phone prefix:', error);
      return [];
    }
  }

  /**
   * Get timezone offset for a country
   */
  static getTimezoneOffset(timezone: string): number {
    try {
      const now = new Date();
      const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
      const targetTime = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
      return (targetTime.getTime() - utc.getTime()) / (1000 * 60 * 60); // Hours
    } catch (error) {
      console.error('Error calculating timezone offset:', error);
      return 0;
    }
  }

  /**
   * Format local time for a country
   */
  static formatLocalTime(timezone: string, date?: Date): string {
    try {
      const targetDate = date || new Date();
      return targetDate.toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch (error) {
      console.error('Error formatting local time:', error);
      return new Date().toLocaleString();
    }
  }

  /**
   * Search countries by name
   */
  static async searchCountries(query: string): Promise<Country[]> {
    try {
      const searchQuery = query.toLowerCase().trim();
      if (!searchQuery || searchQuery.length < 2) {
        return [];
      }

      return await Country.findAll({
        where: { isActive: true },
        order: [['name', 'ASC']],
      }).then(countries =>
        countries.filter(country =>
          country.name.toLowerCase().includes(searchQuery) ||
          country.code.toLowerCase().includes(searchQuery) ||
          country.nameOfficial?.toLowerCase().includes(searchQuery) ||
          country.capital?.toLowerCase().includes(searchQuery),
        ),
      );
    } catch (error) {
      console.error('Error searching countries:', error);
      throw new Error('Failed to search countries');
    }
  }

  /**
   * Get country statistics
   */
  static async getCountryStats(): Promise<{
    totalCountries: number;
    byContinent: Record<string, number>;
    byRegion: Record<string, number>;
    popularCountries: number;
  }> {
    try {
      const countries = await this.getAllCountries();
      const popularCodes = [
        'US', 'CA', 'GB', 'DE', 'FR', 'AU', 'JP', 'SG', 'IN', 'BR',
        'MX', 'ES', 'IT', 'NL', 'KR', 'TH', 'MY', 'ZA', 'AE', 'PH',
      ];

      const byContinent: Record<string, number> = {};
      const byRegion: Record<string, number> = {};

      countries.forEach(country => {
        byContinent[country.continent] = (byContinent[country.continent] || 0) + 1;
        byRegion[country.region] = (byRegion[country.region] || 0) + 1;
      });

      return {
        totalCountries: countries.length,
        byContinent,
        byRegion,
        popularCountries: countries.filter(c => popularCodes.includes(c.code)).length,
      };
    } catch (error) {
      console.error('Error getting country statistics:', error);
      throw new Error('Failed to get country statistics');
    }
  }
}

export default CountryService;
