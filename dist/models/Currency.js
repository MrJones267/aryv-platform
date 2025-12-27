"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Currency = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Currency extends sequelize_1.Model {
    formatAmount(amount) {
        return `${this.symbol}${amount.toFixed(this.decimalPlaces)}`;
    }
    convertFromUSD(usdAmount) {
        return parseFloat((usdAmount * this.exchangeRate).toFixed(this.decimalPlaces));
    }
    convertToUSD(amount) {
        return parseFloat((amount / this.exchangeRate).toFixed(2));
    }
}
exports.Currency = Currency;
Currency.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    code: {
        type: sequelize_1.DataTypes.STRING(3),
        allowNull: false,
        unique: true,
        validate: {
            len: [3, 3],
            isUppercase: true,
        },
        comment: 'ISO 4217 currency code',
    },
    name: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        comment: 'Full currency name',
    },
    symbol: {
        type: sequelize_1.DataTypes.STRING(5),
        allowNull: false,
        comment: 'Currency symbol',
    },
    decimalPlaces: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
        validate: {
            min: 0,
            max: 4,
        },
        comment: 'Number of decimal places for currency',
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether currency is available for transactions',
    },
    exchangeRate: {
        type: sequelize_1.DataTypes.DECIMAL(15, 6),
        allowNull: false,
        defaultValue: 1.0,
        validate: {
            min: 0.000001,
        },
        comment: 'Exchange rate relative to USD base currency',
    },
    lastUpdated: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        comment: 'Last time exchange rate was updated',
    },
    countryCode: {
        type: sequelize_1.DataTypes.STRING(2),
        allowNull: true,
        validate: {
            len: [2, 2],
            isUppercase: true,
        },
        comment: 'ISO country code',
    },
    flag: {
        type: sequelize_1.DataTypes.STRING(10),
        allowNull: true,
        comment: 'Country flag emoji or icon reference',
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
}, {
    sequelize: database_1.sequelize,
    modelName: 'Currency',
    tableName: 'currencies',
    indexes: [
        {
            fields: ['code'],
            unique: true,
        },
        {
            fields: ['isActive'],
        },
        {
            fields: ['countryCode'],
        },
    ],
});
exports.default = Currency;
//# sourceMappingURL=Currency.js.map