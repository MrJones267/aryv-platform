import { Currency } from '../models/Currency';
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
export declare class CurrencyService {
    private static exchangeProviders;
    static getActiveCurrencies(): Promise<Currency[]>;
    static getCurrencyByCode(code: string): Promise<Currency | null>;
    static getUserCurrencies(userId: string): Promise<CurrencyPreferences>;
    static setUserPrimaryCurrency(userId: string, currencyCode: string): Promise<boolean>;
    static addUserPaymentCurrency(userId: string, currencyCode: string): Promise<boolean>;
    static convertCurrency(fromCode: string, toCode: string, amount: number): Promise<CurrencyConversion>;
    static updateExchangeRates(): Promise<{
        updated: number;
        errors: string[];
    }>;
    private static fetchRatesFromProvider;
    private static updateCurrencyRates;
    static formatAmount(amount: number, currency: Currency | string): string;
    static getPopularCurrenciesByRegion(region: string): string[];
    static validateConversionLimits(_fromCode: string, amount: number): {
        isValid: boolean;
        reason?: string;
    };
}
export default CurrencyService;
//# sourceMappingURL=CurrencyService.d.ts.map