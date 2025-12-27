"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryQRCode = exports.QRCodeStatus = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var QRCodeStatus;
(function (QRCodeStatus) {
    QRCodeStatus["ACTIVE"] = "active";
    QRCodeStatus["USED"] = "used";
    QRCodeStatus["EXPIRED"] = "expired";
})(QRCodeStatus || (exports.QRCodeStatus = QRCodeStatus = {}));
class DeliveryQRCode extends sequelize_1.Model {
    isValid() {
        return this.status === QRCodeStatus.ACTIVE && new Date() < this.expiresAt;
    }
    isExpired() {
        return new Date() >= this.expiresAt;
    }
    async scan(userId, location, additionalData) {
        if (!this.isValid()) {
            return false;
        }
        this.status = QRCodeStatus.USED;
        this.scannedAt = new Date();
        this.scannedByUserId = userId;
        if (location) {
            this.scanLocation = location;
        }
        if (additionalData) {
            this.verificationData = {
                ...this.verificationData,
                ...additionalData,
            };
        }
        await this.save();
        return true;
    }
    async expire() {
        this.status = QRCodeStatus.EXPIRED;
        await this.save();
    }
    getTimeUntilExpiry() {
        return this.expiresAt.getTime() - new Date().getTime();
    }
    toJSON() {
        const values = { ...this.get() };
        return {
            ...values,
            isValid: this.isValid(),
            timeUntilExpiry: this.getTimeUntilExpiry(),
        };
    }
}
exports.DeliveryQRCode = DeliveryQRCode;
DeliveryQRCode.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    deliveryAgreementId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'delivery_agreements',
            key: 'id',
        },
        field: 'delivery_agreement_id',
    },
    qrToken: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        field: 'qr_token',
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(QRCodeStatus)),
        allowNull: false,
        defaultValue: QRCodeStatus.ACTIVE,
    },
    generatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'generated_at',
    },
    expiresAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        field: 'expires_at',
    },
    scannedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'scanned_at',
    },
    scannedByUserId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        field: 'scanned_by_user_id',
    },
    scanLocation: {
        type: sequelize_1.DataTypes.GEOMETRY('POINT'),
        allowNull: true,
        field: 'scan_location',
    },
    verificationData: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        field: 'verification_data',
    },
}, {
    sequelize: database_1.sequelize,
    modelName: 'DeliveryQRCode',
    tableName: 'delivery_qr_codes',
    timestamps: false,
    indexes: [
        { fields: ['delivery_agreement_id'] },
        { fields: ['qr_token'] },
        { fields: ['status'] },
        { fields: ['expires_at'] },
    ],
});
exports.default = DeliveryQRCode;
//# sourceMappingURL=DeliveryQRCode.js.map