import { Country } from '../models/Country';
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
export declare class CountryService {
    static getAllCountries(): Promise<Country[]>;
    static getCountriesByRegion(region: string): Promise<Country[]>;
    static getPopularCountries(): Promise<Country[]>;
    static getCountryByCode(code: string): Promise<Country | null>;
    static setUserCountry(userId: string, countryCode: string, updateCurrency?: boolean): Promise<CountrySelectionResult | null>;
    static getSuggestedCurrency(countryCode: string): Promise<{
        code: string;
        name: string;
        symbol: string;
    } | null>;
    static getCountriesWithCurrencies(): Promise<CountryWithCurrencies[]>;
    static getUserCountry(userId: string): Promise<{
        country: Country | null;
        timezone: string | null;
    }>;
    static getCountriesByPhonePrefix(phoneNumber: string): Promise<Country[]>;
    static getTimezoneOffset(timezone: string): number;
    static formatLocalTime(timezone: string, date?: Date): string;
    static searchCountries(query: string): Promise<Country[]>;
    static getCountryStats(): Promise<{
        totalCountries: number;
        byContinent: Record<string, number>;
        byRegion: Record<string, number>;
        popularCountries: number;
    }>;
}
export default CountryService;
//# sourceMappingURL=CountryService.d.ts.map