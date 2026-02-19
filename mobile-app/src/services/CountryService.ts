/**
 * @fileoverview Country Service for mobile app API communication
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { ApiClient } from './ApiClient';
import logger from './LoggingService';

const log = logger.createLogger('CountryService');

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
  
  // Fallback country data for offline/error scenarios
  private static fallbackCountries: Country[] = [
    // SADC countries (primary market)
    {
      id: '1',
      code: 'BW',
      name: 'Botswana',
      nameOfficial: 'Republic of Botswana',
      flag: '🇧🇼',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Southern Africa',
      capital: 'Gaborone',
      phonePrefix: '+267',
      timezones: ['Africa/Gaborone'],
      languages: ['en', 'tn'],
      isActive: true
    },
    {
      id: '2',
      code: 'ZA',
      name: 'South Africa',
      nameOfficial: 'Republic of South Africa',
      flag: '🇿🇦',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Southern Africa',
      capital: 'Pretoria',
      phonePrefix: '+27',
      timezones: ['Africa/Johannesburg'],
      languages: ['en', 'af', 'zu', 'xh', 'st', 'tn'],
      isActive: true
    },
    {
      id: '3',
      code: 'NA',
      name: 'Namibia',
      nameOfficial: 'Republic of Namibia',
      flag: '🇳🇦',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Southern Africa',
      capital: 'Windhoek',
      phonePrefix: '+264',
      timezones: ['Africa/Windhoek'],
      languages: ['en', 'af'],
      isActive: true
    },
    {
      id: '4',
      code: 'ZM',
      name: 'Zambia',
      nameOfficial: 'Republic of Zambia',
      flag: '🇿🇲',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Eastern Africa',
      capital: 'Lusaka',
      phonePrefix: '+260',
      timezones: ['Africa/Lusaka'],
      languages: ['en'],
      isActive: true
    },
    {
      id: '5',
      code: 'ZW',
      name: 'Zimbabwe',
      nameOfficial: 'Republic of Zimbabwe',
      flag: '🇿🇼',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Eastern Africa',
      capital: 'Harare',
      phonePrefix: '+263',
      timezones: ['Africa/Harare'],
      languages: ['en', 'sn', 'nd'],
      isActive: true
    },
    {
      id: '6',
      code: 'MZ',
      name: 'Mozambique',
      nameOfficial: 'Republic of Mozambique',
      flag: '🇲🇿',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Eastern Africa',
      capital: 'Maputo',
      phonePrefix: '+258',
      timezones: ['Africa/Maputo'],
      languages: ['pt'],
      isActive: true
    },
    {
      id: '7',
      code: 'MW',
      name: 'Malawi',
      nameOfficial: 'Republic of Malawi',
      flag: '🇲🇼',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Eastern Africa',
      capital: 'Lilongwe',
      phonePrefix: '+265',
      timezones: ['Africa/Blantyre'],
      languages: ['en', 'ny'],
      isActive: true
    },
    {
      id: '8',
      code: 'SZ',
      name: 'Eswatini',
      nameOfficial: 'Kingdom of Eswatini',
      flag: '🇸🇿',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Southern Africa',
      capital: 'Mbabane',
      phonePrefix: '+268',
      timezones: ['Africa/Mbabane'],
      languages: ['en', 'ss'],
      isActive: true
    },
    {
      id: '9',
      code: 'LS',
      name: 'Lesotho',
      nameOfficial: 'Kingdom of Lesotho',
      flag: '🇱🇸',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Southern Africa',
      capital: 'Maseru',
      phonePrefix: '+266',
      timezones: ['Africa/Maseru'],
      languages: ['en', 'st'],
      isActive: true
    },
    {
      id: '10',
      code: 'AO',
      name: 'Angola',
      nameOfficial: 'Republic of Angola',
      flag: '🇦🇴',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Middle Africa',
      capital: 'Luanda',
      phonePrefix: '+244',
      timezones: ['Africa/Luanda'],
      languages: ['pt'],
      isActive: true
    },
    {
      id: '11',
      code: 'TZ',
      name: 'Tanzania',
      nameOfficial: 'United Republic of Tanzania',
      flag: '🇹🇿',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Eastern Africa',
      capital: 'Dodoma',
      phonePrefix: '+255',
      timezones: ['Africa/Dar_es_Salaam'],
      languages: ['sw', 'en'],
      isActive: true
    },
    {
      id: '12',
      code: 'CD',
      name: 'DR Congo',
      nameOfficial: 'Democratic Republic of the Congo',
      flag: '🇨🇩',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Middle Africa',
      capital: 'Kinshasa',
      phonePrefix: '+243',
      timezones: ['Africa/Kinshasa', 'Africa/Lubumbashi'],
      languages: ['fr'],
      isActive: true
    },
    {
      id: '13',
      code: 'MG',
      name: 'Madagascar',
      nameOfficial: 'Republic of Madagascar',
      flag: '🇲🇬',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Eastern Africa',
      capital: 'Antananarivo',
      phonePrefix: '+261',
      timezones: ['Indian/Antananarivo'],
      languages: ['mg', 'fr'],
      isActive: true
    },
    {
      id: '14',
      code: 'MU',
      name: 'Mauritius',
      nameOfficial: 'Republic of Mauritius',
      flag: '🇲🇺',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Eastern Africa',
      capital: 'Port Louis',
      phonePrefix: '+230',
      timezones: ['Indian/Mauritius'],
      languages: ['en', 'fr'],
      isActive: true
    },
    {
      id: '15',
      code: 'SC',
      name: 'Seychelles',
      nameOfficial: 'Republic of Seychelles',
      flag: '🇸🇨',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Eastern Africa',
      capital: 'Victoria',
      phonePrefix: '+248',
      timezones: ['Indian/Mahe'],
      languages: ['en', 'fr'],
      isActive: true
    },
    // Other African countries
    {
      id: '16',
      code: 'KE',
      name: 'Kenya',
      nameOfficial: 'Republic of Kenya',
      flag: '🇰🇪',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Eastern Africa',
      capital: 'Nairobi',
      phonePrefix: '+254',
      timezones: ['Africa/Nairobi'],
      languages: ['en', 'sw'],
      isActive: true
    },
    {
      id: '17',
      code: 'NG',
      name: 'Nigeria',
      nameOfficial: 'Federal Republic of Nigeria',
      flag: '🇳🇬',
      continent: 'Africa',
      region: 'Africa',
      subRegion: 'Western Africa',
      capital: 'Abuja',
      phonePrefix: '+234',
      timezones: ['Africa/Lagos'],
      languages: ['en'],
      isActive: true
    },
    // International
    {
      id: '18',
      code: 'GB',
      name: 'United Kingdom',
      nameOfficial: 'United Kingdom of Great Britain and Northern Ireland',
      flag: '🇬🇧',
      continent: 'Europe',
      region: 'Europe',
      subRegion: 'Northern Europe',
      capital: 'London',
      phonePrefix: '+44',
      timezones: ['Europe/London'],
      languages: ['en'],
      isActive: true
    },
    {
      id: '19',
      code: 'US',
      name: 'United States',
      nameOfficial: 'United States of America',
      flag: '🇺🇸',
      continent: 'North America',
      region: 'Americas',
      subRegion: 'Northern America',
      capital: 'Washington D.C.',
      phonePrefix: '+1',
      timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'],
      languages: ['en'],
      isActive: true
    },
  ];

  /**
   * Get all available countries
   */
  static async getAllCountries(): Promise<Country[]> {
    try {
      const response = await this.apiClient.get('/countries');
      
      if (response.success && response.data?.countries) {
        return response.data.countries;
      } else {
        log.warn('API countries not available, using fallback data');
        return this.fallbackCountries;
      }
    } catch (error) {
      log.warn('Error fetching countries, using fallback data', { error: error instanceof Error ? error.message : String(error) });
      return this.fallbackCountries;
    }
  }

  /**
   * Get popular countries for ride-sharing
   */
  static async getPopularCountries(): Promise<Country[]> {
    try {
      const response = await this.apiClient.get('/countries/popular');
      
      if (response.success && response.data?.countries) {
        return response.data.countries;
      } else {
        log.warn('API popular countries not available, using fallback data');
        return this.fallbackCountries.slice(0, 6); // Return top 6 countries
      }
    } catch (error) {
      log.warn('Error fetching popular countries, using fallback data', { error: error instanceof Error ? error.message : String(error) });
      return this.fallbackCountries.slice(0, 6);
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
        log.error('Failed to fetch countries by region', response.error);
        return [];
      }
    } catch (error) {
      log.error('Error fetching countries by region', error);
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
        log.error('Failed to fetch country', response.error);
        return null;
      }
    } catch (error) {
      log.error('Error fetching country', error);
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
        log.error('Failed to search countries', response.error);
        return [];
      }
    } catch (error) {
      log.error('Error searching countries', error);
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
        log.error('Failed to set user country', response.error);
        return null;
      }
    } catch (error) {
      log.error('Error setting user country', error);
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
        log.error('Failed to fetch user country', response.error);
        return null;
      }
    } catch (error) {
      log.error('Error fetching user country', error);
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
      log.error('Error getting suggested currency:', error);
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
      log.error('Error getting countries by phone:', error);
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
      log.error('Error formatting local time:', error);
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
      log.error('Error calculating timezone offset:', error);
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
      log.error('Error detecting user country:', error);
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
      'Africa': ['BW', 'ZA', 'NA', 'ZM', 'ZW', 'MZ', 'MW', 'SZ', 'LS', 'AO', 'TZ', 'KE', 'NG'],
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