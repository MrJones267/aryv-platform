/**
 * @fileoverview Currency Controller for handling currency operations
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Request, Response } from 'express';
import { CurrencyService } from '../services/CurrencyService';
import { UserCurrency } from '../models/UserCurrency';
import { AuthenticatedRequest } from '../types';

export class CurrencyController {

  /**
   * Get all available currencies
   */
  static async getCurrencies(_req: Request, res: Response): Promise<Response> {
    try {
      const currencies = await CurrencyService.getActiveCurrencies();

      return res.status(200).json({
        success: true,
        data: {
          currencies: currencies.map(currency => ({
            id: currency.id,
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            decimalPlaces: currency.decimalPlaces,
            flag: currency.flag,
            countryCode: currency.countryCode,
            exchangeRate: currency.exchangeRate,
            lastUpdated: currency.lastUpdated,
          })),
          total: currencies.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CurrencyController] Error fetching currencies:', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        timestamp: new Date().toISOString(),
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch currencies',
        code: 'CURRENCY_FETCH_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get popular currencies by region
   */
  static async getPopularCurrencies(req: Request, res: Response): Promise<Response> {
    try {
      const { region = 'global' } = req.query;

      const popularCodes = CurrencyService.getPopularCurrenciesByRegion(region as string);
      const currencies = await Promise.all(
        popularCodes.map(code => CurrencyService.getCurrencyByCode(code)),
      );

      const validCurrencies = currencies.filter(c => c !== null);

      return res.status(200).json({
        success: true,
        data: {
          currencies: validCurrencies.map(currency => ({
            id: currency!.id,
            code: currency!.code,
            name: currency!.name,
            symbol: currency!.symbol,
            flag: currency!.flag,
            exchangeRate: currency!.exchangeRate,
          })),
          region,
          total: validCurrencies.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CurrencyController] Error fetching popular currencies:', {
        error: (error as Error).message,
        region: req.query['region'],
        timestamp: new Date().toISOString(),
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch popular currencies',
        code: 'POPULAR_CURRENCY_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get user's currency preferences
   */
  static async getUserCurrencies(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          timestamp: new Date().toISOString(),
        });
      }

      const preferences = await CurrencyService.getUserCurrencies(userId);

      return res.status(200).json({
        success: true,
        data: {
          primaryCurrency: {
            id: preferences.primaryCurrency.id,
            code: preferences.primaryCurrency.code,
            name: preferences.primaryCurrency.name,
            symbol: preferences.primaryCurrency.symbol,
            decimalPlaces: preferences.primaryCurrency.decimalPlaces,
            flag: preferences.primaryCurrency.flag,
          },
          availableCurrencies: preferences.availableCurrencies.map(currency => ({
            id: currency.id,
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            flag: currency.flag,
            exchangeRate: currency.exchangeRate,
          })),
          paymentCurrencies: preferences.paymentCurrencies.map(currency => ({
            id: currency.id,
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            flag: currency.flag,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CurrencyController] Error fetching user currencies:', {
        error: (error as Error).message,
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch currency preferences',
        code: 'USER_CURRENCY_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Set user's primary currency
   */
  static async setPrimaryCurrency(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          timestamp: new Date().toISOString(),
        });
      }

      const { currencyCode } = req.body;

      if (!currencyCode || typeof currencyCode !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Currency code is required',
          code: 'INVALID_CURRENCY_CODE',
          timestamp: new Date().toISOString(),
        });
      }

      await CurrencyService.setUserPrimaryCurrency(userId, currencyCode.toUpperCase());

      return res.status(200).json({
        success: true,
        data: {
          message: `Primary currency set to ${currencyCode.toUpperCase()}`,
          currencyCode: currencyCode.toUpperCase(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CurrencyController] Error setting primary currency:', {
        error: (error as Error).message,
        userId: req.user?.id,
        currencyCode: req.body?.currencyCode,
        timestamp: new Date().toISOString(),
      });

      const statusCode = (error as Error).message.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        error: (error as Error).message || 'Failed to set primary currency',
        code: 'SET_PRIMARY_CURRENCY_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Add payment currency for user
   */
  static async addPaymentCurrency(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          timestamp: new Date().toISOString(),
        });
      }

      const { currencyCode } = req.body;

      if (!currencyCode || typeof currencyCode !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Currency code is required',
          code: 'INVALID_CURRENCY_CODE',
          timestamp: new Date().toISOString(),
        });
      }

      await CurrencyService.addUserPaymentCurrency(userId, currencyCode.toUpperCase());

      return res.status(200).json({
        success: true,
        data: {
          message: `Payment currency ${currencyCode.toUpperCase()} added successfully`,
          currencyCode: currencyCode.toUpperCase(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CurrencyController] Error adding payment currency:', {
        error: (error as Error).message,
        userId: req.user?.id,
        currencyCode: req.body?.currencyCode,
        timestamp: new Date().toISOString(),
      });

      const statusCode = (error as Error).message.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        error: (error as Error).message || 'Failed to add payment currency',
        code: 'ADD_PAYMENT_CURRENCY_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Convert currency amount
   */
  static async convertCurrency(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { fromCurrency, toCurrency, amount } = req.body;

      // Validate input
      if (!fromCurrency || !toCurrency || !amount) {
        return res.status(400).json({
          success: false,
          error: 'fromCurrency, toCurrency, and amount are required',
          code: 'MISSING_CONVERSION_PARAMS',
          timestamp: new Date().toISOString(),
        });
      }

      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be a positive number',
          code: 'INVALID_AMOUNT',
          timestamp: new Date().toISOString(),
        });
      }

      // Validate conversion limits
      const validation = CurrencyService.validateConversionLimits(fromCurrency, numericAmount);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: validation.reason,
          code: 'CONVERSION_LIMIT_EXCEEDED',
          timestamp: new Date().toISOString(),
        });
      }

      const conversion = await CurrencyService.convertCurrency(
        fromCurrency.toUpperCase(),
        toCurrency.toUpperCase(),
        numericAmount,
      );

      return res.status(200).json({
        success: true,
        data: conversion,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CurrencyController] Error converting currency:', {
        error: (error as Error).message,
        fromCurrency: req.body?.fromCurrency,
        toCurrency: req.body?.toCurrency,
        amount: req.body?.amount,
        timestamp: new Date().toISOString(),
      });

      return res.status(500).json({
        success: false,
        error: (error as Error).message || 'Failed to convert currency',
        code: 'CURRENCY_CONVERSION_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Update exchange rates (admin only)
   */
  static async updateExchangeRates(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
          code: 'ADMIN_ACCESS_REQUIRED',
          timestamp: new Date().toISOString(),
        });
      }

      const result = await CurrencyService.updateExchangeRates();

      return res.status(200).json({
        success: true,
        data: {
          message: `Updated ${result.updated} exchange rates`,
          updated: result.updated,
          errors: result.errors,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CurrencyController] Error updating exchange rates:', {
        error: (error as Error).message,
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to update exchange rates',
        code: 'EXCHANGE_RATE_UPDATE_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Remove payment currency for user
   */
  static async removePaymentCurrency(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          timestamp: new Date().toISOString(),
        });
      }

      const { currencyCode } = req.params;

      if (!currencyCode) {
        return res.status(400).json({
          success: false,
          error: 'Currency code is required',
          code: 'MISSING_CURRENCY_CODE',
          timestamp: new Date().toISOString(),
        });
      }

      const currency = await CurrencyService.getCurrencyByCode(currencyCode.toUpperCase());
      if (!currency) {
        return res.status(404).json({
          success: false,
          error: 'Currency not found',
          code: 'CURRENCY_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
      }

      // Remove from user's payment currencies (but don't delete if it's primary)
      const userCurrency = await UserCurrency.findOne({
        where: { userId, currencyId: currency.id },
      });

      if (!userCurrency) {
        return res.status(404).json({
          success: false,
          error: 'Currency not in user\'s payment options',
          code: 'CURRENCY_NOT_CONFIGURED',
          timestamp: new Date().toISOString(),
        });
      }

      if (userCurrency.isPrimary) {
        return res.status(400).json({
          success: false,
          error: 'Cannot remove primary currency. Set another currency as primary first.',
          code: 'CANNOT_REMOVE_PRIMARY',
          timestamp: new Date().toISOString(),
        });
      }

      await userCurrency.update({ isPaymentEnabled: false });

      return res.status(200).json({
        success: true,
        data: {
          message: `Payment currency ${currencyCode.toUpperCase()} removed successfully`,
          currencyCode: currencyCode.toUpperCase(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[CurrencyController] Error removing payment currency:', {
        error: (error as Error).message,
        userId: req.user?.id,
        currencyCode: req.params['currencyCode'],
        timestamp: new Date().toISOString(),
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to remove payment currency',
        code: 'REMOVE_PAYMENT_CURRENCY_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export default CurrencyController;
