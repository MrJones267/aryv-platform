/**
 * @fileoverview Country Service for mobile app API communication
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { ApiClient } from './ApiClient';

export interface Country {
  id: string;
  code: string;
  name: string;
  nameOfficial?: string;
  flag?: string;
  continent: string;
  region: string;
  subRegion?: string;
  capital?: string;
  phonePrefix?: string;
  timezones: string[];
  languages: string[];
  isActive: boolean;
}

export interface CountrySelectionResult {
  country: Country;
  suggestedCurrency?: string;
  suggestedTimezone?: string;
  suggestedLanguage?: string;
}

export interface UserCountryInfo {
  country: Country | null;
  timezone: string | null;
}

export class CountryService {
  private static apiClient = new ApiClient();

  /**
   * Get all available countries
   */
  static async getAllCountries(): Promise<Country[]> {
    try {
      const response = await this.apiClient.get('/countries');
      
      if (response.success) {
        return response.data.countries;
      } else {
        console.error('Failed to fetch countries:', response.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching countries:', error);
      return [];
    }
  }

  /**
   * Get popular countries for ride-sharing
   */
  static async getPopularCountries(): Promise<Country[]> {
    try {
      const response = await this.apiClient.get('/countries/popular');
      
      if (response.success) {
        return response.data.countries;
      } else {
        console.error('Failed to fetch popular countries:', response.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching popular countries:', error);
      return [];
    }
  }

  /**
   * Get countries by region/continent
   */
  static async getCountriesByRegion(region: string): Promise<Country[]> {
    try {
      const response = await this.apiClient.get(`/countries/region/${region}`);
      
      if (response.success) {
        return response.data.countries;
      } else {
        console.error('Failed to fetch countries by region:', response.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching countries by region:', error);
      return [];
    }
  }

  /**
   * Get country by code
   */
  static async getCountryByCode(code: string): Promise<Country | null> {
    try {
      const response = await this.apiClient.get(`/countries/${code.toUpperCase()}`);
      
      if (response.success) {
        return response.data.country;
      } else {
        console.error('Failed to fetch country:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error fetching country:', error);
      return null;
    }
  }

  /**
   * Search countries by name or code
   */
  static async searchCountries(query: string): Promise<Country[]> {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }

      const response = await this.apiClient.get(`/countries/search?q=${encodeURIComponent(query)}`);
      
      if (response.success) {
        return response.data.countries;
      } else {
        console.error('Failed to search countries:', response.error);
        return [];
      }
    } catch (error) {
      console.error('Error searching countries:', error);
      return [];
    }
  }

  /**
   * Set user's country of operation
   */
  static async setUserCountry(countryCode: string, updateCurrency: boolean = true): Promise<CountrySelectionResult | null> {
    try {
      const response = await this.apiClient.put('/countries/user', {
        countryCode: countryCode.toUpperCase(),
        updateCurrency
      });
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Failed to set user country:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error setting user country:', error);
      return null;
    }
  }

  /**
   * Get user's current country information
   */
  static async getUserCountry(): Promise<UserCountryInfo | null> {
    try {
      const response = await this.apiClient.get('/countries/user');
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Failed to fetch user country:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user country:', error);
      return null;
    }
  }

  /**
   * Get suggested currency for a country
   */
  static async getSuggestedCurrency(countryCode: string): Promise<{ code: string; name: string; symbol: string } | null> {
    try {
      const response = await this.apiClient.get(`/countries/${countryCode.toUpperCase()}/currency`);
      
      if (response.success) {
        return response.data.suggestedCurrency;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting suggested currency:', error);
      return null;
    }
  }

  /**
   * Get countries by phone number prefix
   */
  static async getCountriesByPhonePrefix(phoneNumber: string): Promise<Country[]> {
    try {
      const response = await this.apiClient.get(`/countries/phone?number=${encodeURIComponent(phoneNumber)}`);
      
      if (response.success) {
        return response.data.countries;
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error getting countries by phone:', error);
      return [];
    }
  }

  /**
   * Format local time for a timezone
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
        timeZoneName: 'short'
      });
    } catch (error) {
      console.error('Error formatting local time:', error);
      return new Date().toLocaleString();
    }
  }

  /**
   * Get timezone offset for a timezone
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
   * Detect user's country from device settings
   */
  static detectUserCountry(): { countryCode?: string; region?: string } {
    try {
      // Try to get country from device locale
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      const countryCode = locale.split('-')[1]?.toUpperCase();
      
      if (countryCode && countryCode.length === 2) {
        return { countryCode };
      }

      // Fallback to timezone detection
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const region = this.getRegionFromTimezone(timezone);
      
      return { region };
    } catch (error) {
      console.error('Error detecting user country:', error);
      return {};
    }
  }

  /**
   * Get region from timezone
   */
  static getRegionFromTimezone(timezone: string): string {
    const timezoneRegions: Record<string, string> = {
      'America/': 'Americas',
      'Europe/': 'Europe',
      'Asia/': 'Asia',
      'Africa/': 'Africa',
      'Australia/': 'Oceania',
      'Pacific/': 'Oceania',
    };

    for (const [prefix, region] of Object.entries(timezoneRegions)) {
      if (timezone.startsWith(prefix)) {
        return region;
      }
    }

    return 'global';
  }

  /**
   * Get country flag emoji
   */
  static getCountryFlag(countryCode?: string): string {
    if (!countryCode || countryCode.length !== 2) return '🌍';
    
    // Convert country code to flag emoji using regional indicator symbols
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    
    return String.fromCodePoint(...codePoints);
  }

  /**
   * Group countries by continent
   */
  static groupCountriesByContinent(countries: Country[]): Record<string, Country[]> {
    const grouped: Record<string, Country[]> = {};
    
    countries.forEach(country => {
      if (!grouped[country.continent]) {
        grouped[country.continent] = [];
      }
      grouped[country.continent].push(country);
    });

    // Sort countries within each continent
    Object.keys(grouped).forEach(continent => {
      grouped[continent].sort((a, b) => a.name.localeCompare(b.name));
    });

    return grouped;
  }

  /**
   * Get popular countries for a specific region
   */
  static getPopularCountriesForRegion(region: string): string[] {
    const popularByRegion: Record<string, string[]> = {
      'Americas': ['US', 'CA', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE'],
      'Europe': ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'CH', 'SE', 'NO'],
      'Asia': ['JP', 'CN', 'IN', 'KR', 'SG', 'TH', 'MY', 'ID', 'PH', 'VN'],
      'Africa': ['ZA', 'NG', 'KE', 'EG', 'MA', 'GH'],
      'Oceania': ['AU', 'NZ'],
    };

    return popularByRegion[region] || popularByRegion['Americas'];
  }

  /**
   * Cache countries locally for offline use
   */
  private static countryCache: Country[] = [];
  private static cacheTimestamp = 0;
  private static CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  static async getCachedCountries(): Promise<Country[]> {
    const now = Date.now();
    
    if (this.countryCache.length === 0 || (now - this.cacheTimestamp) > this.CACHE_DURATION) {
      this.countryCache = await this.getAllCountries();
      this.cacheTimestamp = now;
    }
    
    return this.countryCache;
  }

  /**
   * Validate country code format
   */
  static isValidCountryCode(code: string): boolean {
    return /^[A-Z]{2}$/.test(code);
  }

  /**
   * Format phone number with country prefix
   */
  static formatPhoneNumber(phoneNumber: string, country: Country): string {
    if (!country.phonePrefix) return phoneNumber;
    
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const localNumber = cleanNumber.replace(/^0+/, ''); // Remove leading zeros
    
    return `${country.phonePrefix}${localNumber}`;
  }
}

export default CountryService;