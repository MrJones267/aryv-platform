"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryAgreement = exports.DeliveryStatus = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var DeliveryStatus;
(function (DeliveryStatus) {
    DeliveryStatus["PENDING_PICKUP"] = "pending_pickup";
    DeliveryStatus["IN_TRANSIT"] = "in_transit";
    DeliveryStatus["COMPLETED"] = "completed";
    DeliveryStatus["DISPUTED"] = "disputed";
    DeliveryStatus["CANCELLED"] = "cancelled";
})(DeliveryStatus || (exports.DeliveryStatus = DeliveryStatus = {}));
class DeliveryAgreement extends sequelize_1.Model {
    canTransitionTo(newStatus) {
        const validTransitions = {
            [DeliveryStatus.PENDING_PICKUP]: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.CANCELLED, DeliveryStatus.DISPUTED],
            [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.COMPLETED, DeliveryStatus.DISPUTED, DeliveryStatus.CANCELLED],
            [DeliveryStatus.COMPLETED]: [DeliveryStatus.DISPUTED],
            [DeliveryStatus.DISPUTED]: [DeliveryStatus.COMPLETED, DeliveryStatus.CANCELLED],
            [DeliveryStatus.CANCELLED]: [],
        };
        return validTransitions[this.status]?.includes(newStatus) || false;
    }
    async transitionTo(newStatus, userId, eventData = {}) {
        if (!this.canTransitionTo(newStatus)) {
            throw new Error(`Invalid transition from ${this.status} to ${newStatus}`);
        }
        const oldStatus = this.status;
        this.status = newStatus;
        await this.logEvent('status_transition', {
            from: oldStatus,
            to: newStatus,
            ...eventData,
        }, userId);
        switch (newStatus) {
            case DeliveryStatus.IN_TRANSIT:
                this.pickupConfirmedAt = new Date();
                break;
            case DeliveryStatus.COMPLETED:
                this.deliveryConfirmedAt = new Date();
                break;
        }
        await this.save();
    }
    async logEvent(eventType, eventData = {}, userId) {
        const event = {
            timestamp: new Date().toISOString(),
            event_type: eventType,
            user_id: userId || '',
            data: eventData,
        };
        this.eventLog = [...this.eventLog, event];
        await this.save();
    }
    generateQRToken() {
        const token = Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
        return token.toUpperCase();
    }
    async createQRCode() {
        const token = this.generateQRToken();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        this.qrCodeToken = token;
        this.qrCodeExpiresAt = expiresAt;
        await this.logEvent('qr_code_generated', {
            token: token,
            expires_at: expiresAt.toISOString(),
        });
        await this.save();
    }
    isQRCodeValid() {
        return !!(this.qrCodeToken &&
            this.qrCodeExpiresAt &&
            new Date() < this.qrCodeExpiresAt);
    }
    getEventsByType(eventType) {
        return this.eventLog.filter(event => event.event_type === eventType);
    }
    getLastEvent() {
        return this.eventLog.length > 0 ? this.eventLog[this.eventLog.length - 1] : null;
    }
    toJSON() {
        const values = { ...this.get() };
        return values;
    }
}
exports.DeliveryAgreement = DeliveryAgreement;
DeliveryAgreement.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    packageId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'packages',
            key: 'id',
        },
        field: 'package_id',
    },
    courierId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        field: 'courier_id',
    },
    agreedPrice: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        field: 'agreed_price',
        validate: {
            min: 0.01,
        },
    },
    platformFee: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'platform_fee',
        validate: {
            min: 0,
        },
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(DeliveryStatus)),
        allowNull: false,
        defaultValue: DeliveryStatus.PENDING_PICKUP,
    },
    escrowPaymentId: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        field: 'escrow_payment_id',
    },
    escrowAmount: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        field: 'escrow_amount',
        validate: {
            min: 0,
        },
    },
    escrowHeldAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'escrow_held_at',
    },
    pickupConfirmedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'pickup_confirmed_at',
    },
    pickupLocation: {
        type: sequelize_1.DataTypes.GEOMETRY('POINT'),
        allowNull: true,
        field: 'pickup_location',
    },
    deliveryConfirmedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'delivery_confirmed_at',
    },
    deliveryLocation: {
        type: sequelize_1.DataTypes.GEOMETRY('POINT'),
        allowNull: true,
        field: 'delivery_location',
    },
    paymentReleasedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'payment_released_at',
    },
    qrCodeToken: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        unique: true,
        field: 'qr_code_token',
    },
    qrCodeExpiresAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'qr_code_expires_at',
    },
    eventLog: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        field: 'event_log',
    },
    chatChannelId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        field: 'chat_channel_id',
    },
    courierLocations: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        field: 'courier_locations',
        defaultValue: [],
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'created_at',
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'updated_at',
    },
}, {
    sequelize: database_1.sequelize,
    modelName: 'DeliveryAgreement',
    tableName: 'delivery_agreements',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['package_id'] },
        { fields: ['courier_id'] },
        { fields: ['status'] },
        { fields: ['qr_code_token'] },
        { fields: ['created_at'] },
    ],
});
exports.default = DeliveryAgreement;
//# sourceMappingURL=DeliveryAgreement.js.map