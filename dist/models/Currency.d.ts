import { Model, Optional } from 'sequelize';
export interface CurrencyAttributes {
    id: string;
    code: string;
    name: string;
    symbol: string;
    decimalPlaces: number;
    isActive: boolean;
    exchangeRate: number;
    lastUpdated: Date;
    countryCode?: string;
    flag?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CurrencyCreationAttributes extends Optional<CurrencyAttributes, 'id' | 'createdAt' | 'updatedAt' | 'countryCode' | 'flag'> {
}
export declare class Currency extends Model<CurrencyAttributes, CurrencyCreationAttributes> implements CurrencyAttributes {
    id: string;
    code: string;
    name: string;
    symbol: string;
    decimalPlaces: number;
    isActive: boolean;
    exchangeRate: number;
    lastUpdated: Date;
    countryCode?: string;
    flag?: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    formatAmount(amount: number): string;
    convertFromUSD(usdAmount: number): number;
    convertToUSD(amount: number): number;
}
export default Currency;
//# sourceMappingURL=Currency.d.ts.map