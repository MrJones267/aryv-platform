"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourierLocation = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class CourierLocation extends sequelize_1.Model {
    isRecentLocation() {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return this.timestamp > fiveMinutesAgo;
    }
    isAccurate() {
        return this.accuracy ? this.accuracy <= 50 : true;
    }
    getLocationAge() {
        return Date.now() - this.timestamp.getTime();
    }
    toJSON() {
        const values = { ...this.get() };
        return {
            ...values,
            isRecent: this.isRecentLocation(),
            isAccurate: this.isAccurate(),
            ageInMinutes: Math.floor(this.getLocationAge() / (1000 * 60)),
        };
    }
}
exports.CourierLocation = CourierLocation;
CourierLocation.init({
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
    courierId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        field: 'courier_id',
    },
    location: {
        type: sequelize_1.DataTypes.GEOMETRY('POINT'),
        allowNull: false,
    },
    accuracy: {
        type: sequelize_1.DataTypes.DECIMAL(6, 2),
        allowNull: true,
        validate: {
            min: 0,
        },
    },
    speed: {
        type: sequelize_1.DataTypes.DECIMAL(6, 2),
        allowNull: true,
        validate: {
            min: 0,
        },
    },
    heading: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: 0,
            max: 360,
        },
    },
    timestamp: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
}, {
    sequelize: database_1.sequelize,
    modelName: 'CourierLocation',
    tableName: 'courier_locations',
    timestamps: false,
    indexes: [
        { fields: ['delivery_agreement_id'] },
        { fields: ['courier_id'] },
        {
            fields: ['location'],
            using: 'gist',
        },
        { fields: ['timestamp'] },
    ],
});
exports.default = CourierLocation;
//# sourceMappingURL=CourierLocation.js.map