"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashWalletTransaction = exports.CashWallet = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const CashWallet = database_1.sequelize.define('cash_wallets', {
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
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
    },
    balance: {
        type: sequelize_1.DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
            min: {
                args: [0],
                msg: 'Balance cannot be negative',
            },
        },
    },
    currency: {
        type: sequelize_1.DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'USD',
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('active', 'suspended', 'closed'),
        allowNull: false,
        defaultValue: 'active',
    },
    dailyLoadLimit: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 500.00,
        field: 'daily_load_limit',
    },
    monthlyLoadLimit: {
        type: sequelize_1.DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 10000.00,
        field: 'monthly_load_limit',
    },
    dailySpendLimit: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1000.00,
        field: 'daily_spend_limit',
    },
    monthlySpendLimit: {
        type: sequelize_1.DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 15000.00,
        field: 'monthly_spend_limit',
    },
    kycLevel: {
        type: sequelize_1.DataTypes.ENUM('basic', 'enhanced', 'full'),
        allowNull: false,
        defaultValue: 'basic',
        field: 'kyc_level',
    },
    isVerified: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_verified',
    },
    lastTransactionAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'last_transaction_at',
    },
    frozenBalance: {
        type: sequelize_1.DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'frozen_balance',
    },
    escrowBalance: {
        type: sequelize_1.DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'escrow_balance',
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
    tableName: 'cash_wallets',
    timestamps: true,
    indexes: [
        {
            fields: ['userId'],
            unique: true,
        },
        {
            fields: ['status'],
        },
        {
            fields: ['kycLevel'],
        },
    ],
    getterMethods: {
        availableBalance() {
            return parseFloat((this.balance - this.frozenBalance - this.escrowBalance).toFixed(2));
        },
        totalBalance() {
            return parseFloat((this.balance + this.escrowBalance).toFixed(2));
        },
    },
    validate: {
        validBalances() {
            if (this['frozenBalance'] < 0 || this['escrowBalance'] < 0) {
                throw new Error('Frozen and escrow balances cannot be negative');
            }
            if (this['frozenBalance'] + this['escrowBalance'] > this['balance']) {
                throw new Error('Frozen and escrow balances cannot exceed total balance');
            }
        },
    },
});
exports.CashWallet = CashWallet;
const CashWalletTransaction = database_1.sequelize.define('cash_wallet_transactions', {
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    walletId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        field: 'wallet_id',
        references: {
            model: 'cash_wallets',
            key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
    },
    type: {
        type: sequelize_1.DataTypes.ENUM('load', 'payment', 'refund', 'transfer', 'escrow_hold', 'escrow_release', 'fee', 'bonus'),
        allowNull: false,
    },
    amount: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: {
                args: [0.01],
                msg: 'Amount must be greater than 0',
            },
        },
    },
    currency: {
        type: sequelize_1.DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'USD',
    },
    balanceBefore: {
        type: sequelize_1.DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: 'balance_before',
    },
    balanceAfter: {
        type: sequelize_1.DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: 'balance_after',
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
    },
    source: {
        type: sequelize_1.DataTypes.ENUM('agent', 'kiosk', 'partner_store', 'mobile_money', 'voucher', 'bank_transfer', 'ride_payment', 'refund'),
        allowNull: false,
    },
    sourceReference: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        field: 'source_reference',
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    metadata: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
    },
    processedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'processed_at',
    },
    expiresAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'expires_at',
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
    tableName: 'cash_wallet_transactions',
    timestamps: true,
    indexes: [
        {
            fields: ['walletId'],
        },
        {
            fields: ['type'],
        },
        {
            fields: ['status'],
        },
        {
            fields: ['source'],
        },
        {
            fields: ['sourceReference'],
        },
        {
            fields: ['createdAt'],
        },
        {
            fields: ['processedAt'],
        },
        {
            fields: ['expiresAt'],
        },
    ],
});
exports.CashWalletTransaction = CashWalletTransaction;
CashWallet.hasMany(CashWalletTransaction, {
    foreignKey: 'walletId',
    as: 'transactions',
});
CashWalletTransaction.belongsTo(CashWallet, {
    foreignKey: 'walletId',
    as: 'wallet',
});
exports.default = CashWallet;
//# sourceMappingURL=CashWallet.js.map