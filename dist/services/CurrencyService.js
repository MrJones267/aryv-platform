"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrencyService = void 0;
const Currency_1 = require("../models/Currency");
const UserCurrency_1 = require("../models/UserCurrency");
const axios_1 = __importDefault(require("axios"));
class CurrencyService {
    static async getActiveCurrencies() {
        try {
            return await Currency_1.Currency.findAll({
                where: { isActive: true },
                order: [['code', 'ASC']],
            });
        }
        catch (error) {
            console.error('Error fetching active currencies:', error);
            throw new Error('Failed to fetch currencies');
        }
    }
    static async getCurrencyByCode(code) {
        try {
            return await Currency_1.Currency.findOne({
                where: {
                    code: code.toUpperCase(),
                    isActive: true,
                },
            });
        }
        catch (error) {
            console.error(`Error fetching currency ${code}:`, error);
            return null;
        }
    }
    static async getUserCurrencies(userId) {
        try {
            const userCurrencies = await UserCurrency_1.UserCurrency.findAll({
                where: { userId },
                include: [{
                        model: Currency_1.Currency,
                        as: 'currency',
                        where: { isActive: true },
                    }],
                order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']],
            });
            if (userCurrencies.length === 0) {
                await this.setUserPrimaryCurrency(userId, 'USD');
                return this.getUserCurrencies(userId);
            }
            const primaryCurrency = userCurrencies.find(uc => uc.isPrimary)?.Currency || userCurrencies[0].Currency;
            const availableCurrencies = await this.getActiveCurrencies();
            const paymentCurrencies = userCurrencies
                .filter(uc => uc.isPaymentEnabled)
                .map(uc => uc.Currency);
            return {
                primaryCurrency,
                availableCurrencies,
                paymentCurrencies,
            };
        }
        catch (error) {
            console.error('Error fetching user currencies:', error);
            throw new Error('Failed to fetch user currency preferences');
        }
    }
    static async setUserPrimaryCurrency(userId, currencyCode) {
        try {
            const currency = await this.getCurrencyByCode(currencyCode);
            if (!currency) {
                throw new Error(`Currency ${currencyCode} not found or inactive`);
            }
            const [_userCurrency, _created] = await UserCurrency_1.UserCurrency.upsert({
                userId,
                currencyId: currency.id,
                isPrimary: true,
                isPaymentEnabled: true,
            });
            return true;
        }
        catch (error) {
            console.error('Error setting primary currency:', error);
            throw error;
        }
    }
    static async addUserPaymentCurrency(userId, currencyCode) {
        try {
            const currency = await this.getCurrencyByCode(currencyCode);
            if (!currency) {
                throw new Error(`Currency ${currencyCode} not found or inactive`);
            }
            await UserCurrency_1.UserCurrency.upsert({
                userId,
                currencyId: currency.id,
                isPrimary: false,
                isPaymentEnabled: true,
            });
            return true;
        }
        catch (error) {
            console.error('Error adding payment currency:', error);
            throw error;
        }
    }
    static async convertCurrency(fromCode, toCode, amount) {
        try {
            const fromCurrency = await this.getCurrencyByCode(fromCode);
            const toCurrency = await this.getCurrencyByCode(toCode);
            if (!fromCurrency || !toCurrency) {
                throw new Error(`Invalid currency codes: ${fromCode} or ${toCode}`);
            }
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
        }
        catch (error) {
            console.error('Error converting currency:', error);
            throw error;
        }
    }
    static async updateExchangeRates() {
        const errors = [];
        let updated = 0;
        try {
            for (const provider of this.exchangeProviders) {
                if (!provider.isActive)
                    continue;
                try {
                    const rates = await this.fetchRatesFromProvider(provider);
                    if (rates) {
                        updated = await this.updateCurrencyRates(rates);
                        break;
                    }
                }
                catch (error) {
                    errors.push(`${provider.name}: ${error.message}`);
                }
            }
            return { updated, errors };
        }
        catch (error) {
            console.error('Error updating exchange rates:', error);
            errors.push(`General error: ${error.message}`);
            return { updated: 0, errors };
        }
    }
    static async fetchRatesFromProvider(provider) {
        try {
            const url = provider.apiKey
                ? `${provider.url}?access_key=${provider.apiKey}&base=USD`
                : `${provider.url}/USD`;
            const response = await axios_1.default.get(url, { timeout: 10000 });
            if (response.data && response.data.rates) {
                return response.data.rates;
            }
            return null;
        }
        catch (error) {
            console.error(`Error fetching from ${provider.name}:`, error.message);
            throw error;
        }
    }
    static async updateCurrencyRates(rates) {
        let updated = 0;
        try {
            const currencies = await Currency_1.Currency.findAll({ where: { isActive: true } });
            for (const currency of currencies) {
                if (currency.code === 'USD')
                    continue;
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
        }
        catch (error) {
            console.error('Error updating currency rates:', error);
            throw error;
        }
    }
    static formatAmount(amount, currency) {
        try {
            let currencyObj;
            if (typeof currency === 'string') {
                return `${currency} ${amount.toFixed(2)}`;
            }
            else {
                currencyObj = currency;
            }
            return currencyObj.formatAmount(amount);
        }
        catch (error) {
            console.error('Error formatting amount:', error);
            return `${amount.toFixed(2)}`;
        }
    }
    static getPopularCurrenciesByRegion(region) {
        const popularCurrencies = {
            'north-america': ['USD', 'CAD', 'MXN'],
            'europe': ['EUR', 'GBP', 'CHF'],
            'asia': ['JPY', 'CNY', 'INR'],
            'africa': ['ZAR', 'NGN', 'KES', 'EGP'],
            'south-america': ['BRL', 'ARS', 'CLP'],
            'oceania': ['AUD', 'NZD'],
        };
        return popularCurrencies[region.toLowerCase()] || ['USD', 'EUR', 'GBP'];
    }
    static validateConversionLimits(_fromCode, amount) {
        const maxConversionAmount = 10000;
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
exports.CurrencyService = CurrencyService;
CurrencyService.exchangeProviders = [
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
exports.default = CurrencyService;
//# sourceMappingURL=CurrencyService.js.map