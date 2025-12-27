"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrencyController = void 0;
const CurrencyService_1 = require("../services/CurrencyService");
const UserCurrency_1 = require("../models/UserCurrency");
class CurrencyController {
    static async getCurrencies(_req, res) {
        try {
            const currencies = await CurrencyService_1.CurrencyService.getActiveCurrencies();
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
        }
        catch (error) {
            console.error('[CurrencyController] Error fetching currencies:', {
                error: error.message,
                stack: error.stack,
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
    static async getPopularCurrencies(req, res) {
        try {
            const { region = 'global' } = req.query;
            const popularCodes = CurrencyService_1.CurrencyService.getPopularCurrenciesByRegion(region);
            const currencies = await Promise.all(popularCodes.map(code => CurrencyService_1.CurrencyService.getCurrencyByCode(code)));
            const validCurrencies = currencies.filter(c => c !== null);
            return res.status(200).json({
                success: true,
                data: {
                    currencies: validCurrencies.map(currency => ({
                        id: currency.id,
                        code: currency.code,
                        name: currency.name,
                        symbol: currency.symbol,
                        flag: currency.flag,
                        exchangeRate: currency.exchangeRate,
                    })),
                    region,
                    total: validCurrencies.length,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('[CurrencyController] Error fetching popular currencies:', {
                error: error.message,
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
    static async getUserCurrencies(req, res) {
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
            const preferences = await CurrencyService_1.CurrencyService.getUserCurrencies(userId);
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
        }
        catch (error) {
            console.error('[CurrencyController] Error fetching user currencies:', {
                error: error.message,
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
    static async setPrimaryCurrency(req, res) {
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
            await CurrencyService_1.CurrencyService.setUserPrimaryCurrency(userId, currencyCode.toUpperCase());
            return res.status(200).json({
                success: true,
                data: {
                    message: `Primary currency set to ${currencyCode.toUpperCase()}`,
                    currencyCode: currencyCode.toUpperCase(),
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('[CurrencyController] Error setting primary currency:', {
                error: error.message,
                userId: req.user?.id,
                currencyCode: req.body?.currencyCode,
                timestamp: new Date().toISOString(),
            });
            const statusCode = error.message.includes('not found') ? 404 : 500;
            return res.status(statusCode).json({
                success: false,
                error: error.message || 'Failed to set primary currency',
                code: 'SET_PRIMARY_CURRENCY_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async addPaymentCurrency(req, res) {
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
            await CurrencyService_1.CurrencyService.addUserPaymentCurrency(userId, currencyCode.toUpperCase());
            return res.status(200).json({
                success: true,
                data: {
                    message: `Payment currency ${currencyCode.toUpperCase()} added successfully`,
                    currencyCode: currencyCode.toUpperCase(),
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('[CurrencyController] Error adding payment currency:', {
                error: error.message,
                userId: req.user?.id,
                currencyCode: req.body?.currencyCode,
                timestamp: new Date().toISOString(),
            });
            const statusCode = error.message.includes('not found') ? 404 : 500;
            return res.status(statusCode).json({
                success: false,
                error: error.message || 'Failed to add payment currency',
                code: 'ADD_PAYMENT_CURRENCY_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async convertCurrency(req, res) {
        try {
            const { fromCurrency, toCurrency, amount } = req.body;
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
            const validation = CurrencyService_1.CurrencyService.validateConversionLimits(fromCurrency, numericAmount);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: validation.reason,
                    code: 'CONVERSION_LIMIT_EXCEEDED',
                    timestamp: new Date().toISOString(),
                });
            }
            const conversion = await CurrencyService_1.CurrencyService.convertCurrency(fromCurrency.toUpperCase(), toCurrency.toUpperCase(), numericAmount);
            return res.status(200).json({
                success: true,
                data: conversion,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('[CurrencyController] Error converting currency:', {
                error: error.message,
                fromCurrency: req.body?.fromCurrency,
                toCurrency: req.body?.toCurrency,
                amount: req.body?.amount,
                timestamp: new Date().toISOString(),
            });
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to convert currency',
                code: 'CURRENCY_CONVERSION_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async updateExchangeRates(req, res) {
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
            const result = await CurrencyService_1.CurrencyService.updateExchangeRates();
            return res.status(200).json({
                success: true,
                data: {
                    message: `Updated ${result.updated} exchange rates`,
                    updated: result.updated,
                    errors: result.errors,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('[CurrencyController] Error updating exchange rates:', {
                error: error.message,
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
    static async removePaymentCurrency(req, res) {
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
            const currency = await CurrencyService_1.CurrencyService.getCurrencyByCode(currencyCode.toUpperCase());
            if (!currency) {
                return res.status(404).json({
                    success: false,
                    error: 'Currency not found',
                    code: 'CURRENCY_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
            }
            const userCurrency = await UserCurrency_1.UserCurrency.findOne({
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
        }
        catch (error) {
            console.error('[CurrencyController] Error removing payment currency:', {
                error: error.message,
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
exports.CurrencyController = CurrencyController;
exports.default = CurrencyController;
//# sourceMappingURL=CurrencyController.js.map