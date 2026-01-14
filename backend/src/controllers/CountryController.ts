/**
 * @fileoverview Country Controller for handling country and dialing code operations
 * @author Oabona-Majoko
 * @created 2026-01-05
 * @lastModified 2026-01-05
 */

import { Request, Response } from 'express';

export class CountryController {
  
  // Fallback country data with dialing codes
  private static fallbackCountries = [
    {
      code: 'US',
      name: 'United States',
      flag: '🇺🇸',
      dialingCode: '+1',
      currency: 'USD',
      region: 'North America',
      isPopular: true
    },
    {
      code: 'GB',
      name: 'United Kingdom',
      flag: '🇬🇧',
      dialingCode: '+44',
      currency: 'GBP',
      region: 'Europe',
      isPopular: true
    },
    {
      code: 'DE',
      name: 'Germany',
      flag: '🇩🇪',
      dialingCode: '+49',
      currency: 'EUR',
      region: 'Europe',
      isPopular: true
    },
    {
      code: 'KE',
      name: 'Kenya',
      flag: '🇰🇪',
      dialingCode: '+254',
      currency: 'KES',
      region: 'Africa',
      isPopular: false
    },
    {
      code: 'NG',
      name: 'Nigeria',
      flag: '🇳🇬',
      dialingCode: '+234',
      currency: 'NGN',
      region: 'Africa',
      isPopular: false
    },
    {
      code: 'ZA',
      name: 'South Africa',
      flag: '🇿🇦',
      dialingCode: '+27',
      currency: 'ZAR',
      region: 'Africa',
      isPopular: false
    },
    {
      code: 'CA',
      name: 'Canada',
      flag: '🇨🇦',
      dialingCode: '+1',
      currency: 'CAD',
      region: 'North America',
      isPopular: true
    },
    {
      code: 'AU',
      name: 'Australia',
      flag: '🇦🇺',
      dialingCode: '+61',
      currency: 'AUD',
      region: 'Oceania',
      isPopular: true
    }
  ];

  /**
   * Get all countries with dialing codes
   */
  static async getCountries(_req: Request, res: Response): Promise<Response> {
    try {
      return res.status(200).json({
        success: true,
        data: {
          countries: this.fallbackCountries.map(country => ({
            code: country.code,
            name: country.name,
            flag: country.flag,
            dialingCode: country.dialingCode,
            currency: country.currency,
            region: country.region,
            isPopular: country.isPopular
          })),
          total: this.fallbackCountries.length,
          source: 'fallback'
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CountryController] Error fetching countries:', {
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        data: {
          countries: this.fallbackCountries,
          total: this.fallbackCountries.length,
          source: 'fallback',
          warning: 'Using fallback data due to error'
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get popular countries
   */
  static async getPopularCountries(_req: Request, res: Response): Promise<Response> {
    try {
      const popularCountries = this.fallbackCountries.filter(c => c.isPopular);

      return res.status(200).json({
        success: true,
        data: {
          countries: popularCountries.map(country => ({
            code: country.code,
            name: country.name,
            flag: country.flag,
            dialingCode: country.dialingCode,
            currency: country.currency,
            region: country.region,
            isPopular: country.isPopular
          })),
          total: popularCountries.length,
          source: 'fallback'
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CountryController] Error fetching popular countries:', {
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      });

      const popularFallback = this.fallbackCountries.filter(c => c.isPopular);
      
      return res.status(200).json({
        success: true,
        data: {
          countries: popularFallback,
          total: popularFallback.length,
          source: 'fallback',
          warning: 'Using fallback data due to error'
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get country by code
   */
  static async getCountryByCode(req: Request, res: Response): Promise<Response> {
    try {
      const { countryCode } = req.params;

      if (!countryCode) {
        return res.status(400).json({
          success: false,
          error: 'Country code is required',
          code: 'MISSING_COUNTRY_CODE',
          timestamp: new Date().toISOString(),
        });
      }

      const country = this.fallbackCountries.find(
        c => c.code.toLowerCase() === countryCode.toLowerCase()
      );

      if (!country) {
        return res.status(404).json({
          success: false,
          error: 'Country not found',
          code: 'COUNTRY_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          country: {
            code: country.code,
            name: country.name,
            flag: country.flag,
            dialingCode: country.dialingCode,
            currency: country.currency,
            region: country.region,
            isPopular: country.isPopular
          },
          source: 'fallback'
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CountryController] Error fetching country by code:', {
        error: (error as Error).message,
        countryCode: req.params['countryCode'],
        timestamp: new Date().toISOString(),
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch country',
        code: 'COUNTRY_FETCH_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get countries by region
   */
  static async getCountriesByRegion(req: Request, res: Response): Promise<Response> {
    try {
      const { region } = req.params;

      if (!region) {
        return res.status(400).json({
          success: false,
          error: 'Region is required',
          code: 'MISSING_REGION',
          timestamp: new Date().toISOString(),
        });
      }

      const countries = this.fallbackCountries.filter(
        c => c.region.toLowerCase() === region.toLowerCase()
      );

      return res.status(200).json({
        success: true,
        data: {
          countries: countries.map(country => ({
            code: country.code,
            name: country.name,
            flag: country.flag,
            dialingCode: country.dialingCode,
            currency: country.currency,
            region: country.region,
            isPopular: country.isPopular
          })),
          region,
          total: countries.length,
          source: 'fallback'
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CountryController] Error fetching countries by region:', {
        error: (error as Error).message,
        region: req.params['region'],
        timestamp: new Date().toISOString(),
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch countries by region',
        code: 'REGION_FETCH_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Search countries by name
   */
  static async searchCountries(req: Request, res: Response): Promise<Response> {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Search query is required',
          code: 'MISSING_SEARCH_QUERY',
          timestamp: new Date().toISOString(),
        });
      }

      const searchTerm = q.toLowerCase();
      const matchingCountries = this.fallbackCountries.filter(
        country => 
          country.name.toLowerCase().includes(searchTerm) ||
          country.code.toLowerCase().includes(searchTerm) ||
          country.dialingCode.includes(searchTerm)
      );

      return res.status(200).json({
        success: true,
        data: {
          countries: matchingCountries.map(country => ({
            code: country.code,
            name: country.name,
            flag: country.flag,
            dialingCode: country.dialingCode,
            currency: country.currency,
            region: country.region,
            isPopular: country.isPopular
          })),
          query: q,
          total: matchingCountries.length,
          source: 'fallback'
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CountryController] Error searching countries:', {
        error: (error as Error).message,
        query: req.query['q'],
        timestamp: new Date().toISOString(),
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to search countries',
        code: 'COUNTRY_SEARCH_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export default CountryController;