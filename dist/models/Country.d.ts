import { Model, Optional } from 'sequelize';
export interface CountryAttributes {
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
    createdAt: Date;
    updatedAt: Date;
}
export interface CountryCreationAttributes extends Optional<CountryAttributes, 'id' | 'createdAt' | 'updatedAt' | 'nameOfficial' | 'flag' | 'subRegion' | 'capital' | 'phonePrefix'> {
}
export declare class Country extends Model<CountryAttributes, CountryCreationAttributes> implements CountryAttributes {
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
    readonly createdAt: Date;
    readonly updatedAt: Date;
    getPrimaryTimezone(): string;
    getPrimaryLanguage(): string;
    getPhoneNumber(localNumber: string): string;
    isInRegion(region: string): boolean;
}
export default Country;
//# sourceMappingURL=Country.d.ts.map