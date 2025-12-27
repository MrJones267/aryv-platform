"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserWallet = exports.VerificationLevel = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var VerificationLevel;
(function (VerificationLevel) {
    VerificationLevel["BASIC"] = "basic";
    VerificationLevel["VERIFIED"] = "verified";
    VerificationLevel["PREMIUM"] = "premium";
})(VerificationLevel || (exports.VerificationLevel = VerificationLevel = {}));
const UserWallet = database_1.sequelize.define('user_wallets', {
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    userId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        unique: true,
        field: 'user_id',
        references: {
            model: 'users',
            key: 'id',
        },
    },
    availableBalance: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'available_balance',
    },
    pendingBalance: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'pending_balance',
    },
    escrowBalance: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'escrow_balance',
    },
    dailyCashLimit: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 100.00,
        field: 'daily_cash_limit',
    },
    weeklyCashLimit: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 500.00,
        field: 'weekly_cash_limit',
    },
    monthlyCashLimit: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 2000.00,
        field: 'monthly_cash_limit',
    },
    dailyCashUsed: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'daily_cash_used',
    },
    weeklyCashUsed: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'weekly_cash_used',
    },
    monthlyCashUsed: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'monthly_cash_used',
    },
    lastResetDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'last_reset_date',
    },
    verificationLevel: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(VerificationLevel)),
        allowNull: false,
        defaultValue: VerificationLevel.BASIC,
        field: 'verification_level',
    },
    phoneVerified: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'phone_verified',
    },
    idVerified: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'id_verified',
    },
    addressVerified: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'address_verified',
    },
    trustScore: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50,
        field: 'trust_score',
        validate: {
            min: 0,
            max: 100,
        },
    },
    completedCashTransactions: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'completed_cash_transactions',
    },
    disputedTransactions: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'disputed_transactions',
    },
    successfulTransactions: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'successful_transactions',
    },
    totalTransactionValue: {
        type: sequelize_1.DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'total_transaction_value',
    },
    averageTransactionValue: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'average_transaction_value',
    },
    lastTrustScoreUpdate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'last_trust_score_update',
    },
    isSuspended: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_suspended',
    },
    suspensionReason: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        field: 'suspension_reason',
    },
    suspendedUntil: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'suspended_until',
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
    },
}, {
    tableName: 'user_wallets',
    timestamps: true,
    indexes: [
        {
            fields: ['user_id'],
            unique: true,
        },
        {
            fields: ['trust_score'],
        },
        {
            fields: ['verification_level'],
        },
        {
            fields: ['is_suspended'],
        },
    ],
});
exports.UserWallet = UserWallet;
exports.default = UserWallet;
//# sourceMappingURL=UserWallet.js.map