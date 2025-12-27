"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CountryService = void 0;
const Country_1 = require("../models/Country");
const User_1 = __importDefault(require("../models/User"));
const CurrencyService_1 = require("./CurrencyService");
class CountryService {
    static async getAllCountries() {
        try {
            return await Country_1.Country.findAll({
                where: { isActive: true },
                order: [['name', 'ASC']],
            });
        }
        catch (error) {
            console.error('Error fetching countries:', error);
            throw new Error('Failed to fetch countries');
        }
    }
    static async getCountriesByRegion(region) {
        try {
            const normalizedRegion = region.toLowerCase();
            return await Country_1.Country.findAll({
                where: {
                    isActive: true,
                },
                order: [['name', 'ASC']],
            }).then(countries => countries.filter(country => country.continent.toLowerCase().includes(normalizedRegion) ||
                country.region.toLowerCase().includes(normalizedRegion) ||
                country.subRegion?.toLowerCase().includes(normalizedRegion)));
        }
        catch (error) {
            console.error('Error fetching countries by region:', error);
            throw new Error('Failed to fetch countries by region');
        }
    }
    static async getPopularCountries() {
        try {
            const popularCountryCodes = [
                'US', 'CA', 'GB', 'DE', 'FR', 'AU', 'JP', 'SG', 'IN', 'BR',
                'MX', 'ES', 'IT', 'NL', 'KR', 'TH', 'MY', 'ZA', 'AE', 'PH',
            ];
            return await Country_1.Country.findAll({
                where: {
                    code: popularCountryCodes,
                    isActive: true,
                },
                order: [['name', 'ASC']],
            });
        }
        catch (error) {
            console.error('Error fetching popular countries:', error);
            throw new Error('Failed to fetch popular countries');
        }
    }
    static async getCountryByCode(code) {
        try {
            return await Country_1.Country.findOne({
                where: {
                    code: code.toUpperCase(),
                    isActive: true,
                },
            });
        }
        catch (error) {
            console.error(`Error fetching country ${code}:`, error);
            return null;
        }
    }
    static async setUserCountry(userId, countryCode, updateCurrency = true) {
        try {
            const country = await this.getCountryByCode(countryCode);
            if (!country) {
                throw new Error(`Country with code ${countryCode} not found`);
            }
            const user = await User_1.default.findByPk(userId);
            if (!user) {
                throw new Error('User not found');
            }
            await user.update({
                countryCode: country.code,
                countryName: country.name,
                timezone: country.getPrimaryTimezone(),
            });
            const result = {
                country,
                suggestedTimezone: country.getPrimaryTimezone(),
                suggestedLanguage: country.getPrimaryLanguage(),
            };
            if (updateCurrency) {
                const suggestedCurrency = await this.getSuggestedCurrency(country.code);
                if (suggestedCurrency) {
                    result.suggestedCurrency = suggestedCurrency.code;
                    try {
                        const userPreferences = await CurrencyService_1.CurrencyService.getUserCurrencies(userId);
                        if (!userPreferences.primaryCurrency || userPreferences.primaryCurrency.code === 'USD') {
                            await CurrencyService_1.CurrencyService.setUserPrimaryCurrency(userId, suggestedCurrency.code);
                        }
                    }
                    catch (error) {
                        console.warn('Could not auto-update user currency:', error);
                    }
                }
            }
            return result;
        }
        catch (error) {
            console.error('Error setting user country:', error);
            throw error;
        }
    }
    static async getSuggestedCurrency(countryCode) {
        try {
            const countryToCurrency = {
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
                return null;
            }
            const currency = await CurrencyService_1.CurrencyService.getCurrencyByCode(currencyCode);
            if (!currency) {
                return null;
            }
            return {
                code: currency.code,
                name: currency.name,
                symbol: currency.symbol,
            };
        }
        catch (error) {
            console.error('Error getting suggested currency:', error);
            return null;
        }
    }
    static async getCountriesWithCurrencies() {
        try {
            const countries = await this.getAllCountries();
            const result = [];
            for (const country of countries) {
                const suggestedCurrency = await this.getSuggestedCurrency(country.code);
                const countryWithCurrency = {
                    ...country.toJSON(),
                    suggestedCurrencies: suggestedCurrency ? [{
                            code: suggestedCurrency.code,
                            name: suggestedCurrency.name,
                            symbol: suggestedCurrency.symbol,
                            isPrimary: true,
                        }] : undefined,
                };
                result.push(countryWithCurrency);
            }
            return result;
        }
        catch (error) {
            console.error('Error fetching countries with currencies:', error);
            throw new Error('Failed to fetch countries with currencies');
        }
    }
    static async getUserCountry(userId) {
        try {
            const user = await User_1.default.findByPk(userId);
            if (!user || !user.countryCode) {
                return { country: null, timezone: null };
            }
            const country = await this.getCountryByCode(user.countryCode);
            return {
                country,
                timezone: user.timezone,
            };
        }
        catch (error) {
            console.error('Error fetching user country:', error);
            return { country: null, timezone: null };
        }
    }
    static async getCountriesByPhonePrefix(phoneNumber) {
        try {
            const cleanPhone = phoneNumber.replace(/\D/g, '');
            if (!cleanPhone.startsWith('1') && cleanPhone.length < 7) {
                return [];
            }
            const possiblePrefixes = [];
            for (let i = 1; i <= Math.min(4, cleanPhone.length); i++) {
                possiblePrefixes.push(`+${cleanPhone.substring(0, i)}`);
            }
            return await Country_1.Country.findAll({
                where: {
                    phonePrefix: possiblePrefixes,
                    isActive: true,
                },
                order: [['name', 'ASC']],
            });
        }
        catch (error) {
            console.error('Error getting countries by phone prefix:', error);
            return [];
        }
    }
    static getTimezoneOffset(timezone) {
        try {
            const now = new Date();
            const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
            const targetTime = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
            return (targetTime.getTime() - utc.getTime()) / (1000 * 60 * 60);
        }
        catch (error) {
            console.error('Error calculating timezone offset:', error);
            return 0;
        }
    }
    static formatLocalTime(timezone, date) {
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
        }
        catch (error) {
            console.error('Error formatting local time:', error);
            return new Date().toLocaleString();
        }
    }
    static async searchCountries(query) {
        try {
            const searchQuery = query.toLowerCase().trim();
            if (!searchQuery || searchQuery.length < 2) {
                return [];
            }
            return await Country_1.Country.findAll({
                where: { isActive: true },
                order: [['name', 'ASC']],
            }).then(countries => countries.filter(country => country.name.toLowerCase().includes(searchQuery) ||
                country.code.toLowerCase().includes(searchQuery) ||
                country.nameOfficial?.toLowerCase().includes(searchQuery) ||
                country.capital?.toLowerCase().includes(searchQuery)));
        }
        catch (error) {
            console.error('Error searching countries:', error);
            throw new Error('Failed to search countries');
        }
    }
    static async getCountryStats() {
        try {
            const countries = await this.getAllCountries();
            const popularCodes = [
                'US', 'CA', 'GB', 'DE', 'FR', 'AU', 'JP', 'SG', 'IN', 'BR',
                'MX', 'ES', 'IT', 'NL', 'KR', 'TH', 'MY', 'ZA', 'AE', 'PH',
            ];
            const byContinent = {};
            const byRegion = {};
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
        }
        catch (error) {
            console.error('Error getting country statistics:', error);
            throw new Error('Failed to get country statistics');
        }
    }
}
exports.CountryService = CountryService;
exports.default = CountryService;
//# sourceMappingURL=CountryService.js.map