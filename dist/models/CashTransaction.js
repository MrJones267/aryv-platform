"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashTransaction = exports.CashPaymentStatus = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var CashPaymentStatus;
(function (CashPaymentStatus) {
    CashPaymentStatus["PENDING_VERIFICATION"] = "pending_verification";
    CashPaymentStatus["DRIVER_CONFIRMED"] = "driver_confirmed";
    CashPaymentStatus["RIDER_CONFIRMED"] = "rider_confirmed";
    CashPaymentStatus["BOTH_CONFIRMED"] = "both_confirmed";
    CashPaymentStatus["DISPUTED"] = "disputed";
    CashPaymentStatus["COMPLETED"] = "completed";
    CashPaymentStatus["FAILED"] = "failed";
    CashPaymentStatus["EXPIRED"] = "expired";
})(CashPaymentStatus || (exports.CashPaymentStatus = CashPaymentStatus = {}));
const CashTransaction = database_1.sequelize.define('cash_transactions', {
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    bookingId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        field: 'booking_id',
        references: {
            model: 'bookings',
            key: 'id',
        },
    },
    riderId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        field: 'rider_id',
        references: {
            model: 'users',
            key: 'id',
        },
    },
    driverId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        field: 'driver_id',
        references: {
            model: 'users',
            key: 'id',
        },
    },
    amount: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        validate: {
            min: 0.01,
            max: 10000.00,
        },
    },
    platformFee: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'platform_fee',
    },
    expectedAmount: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        field: 'expected_amount',
    },
    actualAmountClaimed: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: true,
        field: 'actual_amount_claimed',
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(CashPaymentStatus)),
        allowNull: false,
        defaultValue: CashPaymentStatus.PENDING_VERIFICATION,
    },
    riderConfirmedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'rider_confirmed_at',
    },
    driverConfirmedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'driver_confirmed_at',
    },
    riderConfirmationCode: {
        type: sequelize_1.DataTypes.STRING(6),
        allowNull: false,
        field: 'rider_confirmation_code',
    },
    driverConfirmationCode: {
        type: sequelize_1.DataTypes.STRING(6),
        allowNull: false,
        field: 'driver_confirmation_code',
    },
    verificationPhoto: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
        field: 'verification_photo',
    },
    gpsLocationConfirmed: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'gps_location_confirmed',
    },
    transactionLocation: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        field: 'transaction_location',
    },
    disputeReason: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        field: 'dispute_reason',
    },
    disputeResolvedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'dispute_resolved_at',
    },
    disputeResolution: {
        type: sequelize_1.DataTypes.ENUM('rider_favor', 'driver_favor', 'split'),
        allowNull: true,
        field: 'dispute_resolution',
    },
    riskScore: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'risk_score',
        validate: {
            min: 0,
            max: 100,
        },
    },
    fraudFlags: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        field: 'fraud_flags',
    },
    metadata: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
    },
    expiresAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
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
    tableName: 'cash_transactions',
    timestamps: true,
    indexes: [
        {
            fields: ['booking_id'],
        },
        {
            fields: ['rider_id'],
        },
        {
            fields: ['driver_id'],
        },
        {
            fields: ['status'],
        },
        {
            fields: ['created_at'],
        },
        {
            fields: ['expires_at'],
        },
        {
            fields: ['risk_score'],
        },
    ],
});
exports.CashTransaction = CashTransaction;
exports.default = CashTransaction;
//# sourceMappingURL=CashTransaction.js.map