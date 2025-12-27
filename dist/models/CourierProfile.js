"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourierProfile = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const Package_1 = require("./Package");
class CourierProfile extends sequelize_1.Model {
    getSuccessRate() {
        if (this.totalDeliveries === 0)
            return 100;
        return (this.successfulDeliveries / this.totalDeliveries) * 100;
    }
    canHandlePackage(packageSize, weight) {
        if (!this.preferredPackageSizes.includes(packageSize)) {
            return false;
        }
        if (weight && this.maxPackageWeight && weight > this.maxPackageWeight) {
            return false;
        }
        return true;
    }
    async updateRating(newRating) {
        const totalRatingPoints = this.courierRating * this.totalDeliveries;
        const newTotalRatingPoints = totalRatingPoints + newRating;
        const newTotalDeliveries = this.totalDeliveries + 1;
        this.courierRating = newTotalRatingPoints / newTotalDeliveries;
        this.totalDeliveries = newTotalDeliveries;
        await this.save();
    }
    async recordSuccessfulDelivery(earnings) {
        this.successfulDeliveries += 1;
        this.totalCourierEarnings += earnings;
        await this.save();
    }
    toJSON() {
        const values = { ...this.get() };
        return {
            ...values,
            successRate: this.getSuccessRate(),
        };
    }
}
exports.CourierProfile = CourierProfile;
CourierProfile.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    userId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
            model: 'users',
            key: 'id',
        },
        field: 'user_id',
    },
    isCourierActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_courier_active',
    },
    courierRating: {
        type: sequelize_1.DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 5.0,
        field: 'courier_rating',
        validate: {
            min: 0,
            max: 5,
        },
    },
    totalDeliveries: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'total_deliveries',
        validate: {
            min: 0,
        },
    },
    successfulDeliveries: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'successful_deliveries',
        validate: {
            min: 0,
        },
    },
    totalCourierEarnings: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'total_courier_earnings',
        validate: {
            min: 0,
        },
    },
    preferredPackageSizes: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.ENUM(...Object.values(Package_1.PackageSize))),
        allowNull: false,
        defaultValue: [Package_1.PackageSize.SMALL, Package_1.PackageSize.MEDIUM],
        field: 'preferred_package_sizes',
    },
    maxPackageWeight: {
        type: sequelize_1.DataTypes.DECIMAL(8, 3),
        allowNull: true,
        field: 'max_package_weight',
        validate: {
            min: 0,
        },
    },
    deliveryRadius: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: true,
        field: 'delivery_radius',
        validate: {
            min: 0,
        },
    },
    isAvailableForDeliveries: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_available_for_deliveries',
    },
    verificationDocuments: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        field: 'verification_documents',
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
    modelName: 'CourierProfile',
    tableName: 'courier_profiles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['user_id'] },
        { fields: ['is_courier_active'] },
        { fields: ['is_available_for_deliveries'] },
    ],
});
exports.default = CourierProfile;
//# sourceMappingURL=CourierProfile.js.map