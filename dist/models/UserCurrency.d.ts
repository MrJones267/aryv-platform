import { Model, Optional } from 'sequelize';
import User from './User';
import { Currency } from './Currency';
export interface UserCurrencyAttributes {
    id: string;
    userId: string;
    currencyId: string;
    isPrimary: boolean;
    isPaymentEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserCurrencyCreationAttributes extends Optional<UserCurrencyAttributes, 'id' | 'createdAt' | 'updatedAt'> {
}
export declare class UserCurrency extends Model<UserCurrencyAttributes, UserCurrencyCreationAttributes> implements UserCurrencyAttributes {
    id: string;
    userId: string;
    currencyId: string;
    isPrimary: boolean;
    isPaymentEnabled: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    Currency?: Currency;
    User?: typeof User;
}
export default UserCurrency;
//# sourceMappingURL=UserCurrency.d.ts.map