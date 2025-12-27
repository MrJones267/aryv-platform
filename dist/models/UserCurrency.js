"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserCurrency = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = __importDefault(require("./User"));
const Currency_1 = require("./Currency");
class UserCurrency extends sequelize_1.Model {
}
exports.UserCurrency = UserCurrency;
UserCurrency.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    userId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
    },
    currencyId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'currencies',
            key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
    },
    isPrimary: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Primary currency for display purposes',
    },
    isPaymentEnabled: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether user can make payments in this currency',
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
    modelName: 'UserCurrency',
    tableName: 'user_currencies',
    indexes: [
        {
            fields: ['userId'],
        },
        {
            fields: ['currencyId'],
        },
        {
            fields: ['userId', 'isPrimary'],
        },
        {
            fields: ['userId', 'currencyId'],
            unique: true,
        },
    ],
});
UserCurrency.belongsTo(User_1.default, {
    foreignKey: 'userId',
    as: 'user',
});
UserCurrency.belongsTo(Currency_1.Currency, {
    foreignKey: 'currencyId',
    as: 'currency',
});
User_1.default.hasMany(UserCurrency, {
    foreignKey: 'userId',
    as: 'currencies',
});
Currency_1.Currency.hasMany(UserCurrency, {
    foreignKey: 'currencyId',
    as: 'userCurrencies',
});
exports.default = UserCurrency;
//# sourceMappingURL=UserCurrency.js.map