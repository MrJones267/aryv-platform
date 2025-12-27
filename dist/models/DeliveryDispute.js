"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryDispute = exports.DisputeType = exports.DisputeStatus = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var DisputeStatus;
(function (DisputeStatus) {
    DisputeStatus["OPEN"] = "open";
    DisputeStatus["UNDER_REVIEW"] = "under_review";
    DisputeStatus["RESOLVED"] = "resolved";
    DisputeStatus["CLOSED"] = "closed";
})(DisputeStatus || (exports.DisputeStatus = DisputeStatus = {}));
var DisputeType;
(function (DisputeType) {
    DisputeType["PACKAGE_NOT_DELIVERED"] = "package_not_delivered";
    DisputeType["PACKAGE_DAMAGED"] = "package_damaged";
    DisputeType["INCORRECT_LOCATION"] = "incorrect_location";
    DisputeType["WRONG_RECIPIENT"] = "wrong_recipient";
    DisputeType["LATE_DELIVERY"] = "late_delivery";
    DisputeType["COURIER_NO_SHOW"] = "courier_no_show";
    DisputeType["OTHER"] = "other";
})(DisputeType || (exports.DisputeType = DisputeType = {}));
class DeliveryDispute extends sequelize_1.Model {
    isOpen() {
        return this.status === DisputeStatus.OPEN;
    }
    isResolved() {
        return this.status === DisputeStatus.RESOLVED || this.status === DisputeStatus.CLOSED;
    }
    canBeResolved() {
        return this.status === DisputeStatus.OPEN || this.status === DisputeStatus.UNDER_REVIEW;
    }
    async moveToReview(_adminId, notes) {
        if (this.status !== DisputeStatus.OPEN) {
            throw new Error('Dispute must be in OPEN status to move to review');
        }
        this.status = DisputeStatus.UNDER_REVIEW;
        if (notes) {
            this.adminNotes = notes;
        }
        await this.save();
    }
    async resolve(adminId, resolutionAmount, notes) {
        if (!this.canBeResolved()) {
            throw new Error('Dispute cannot be resolved in current status');
        }
        this.status = DisputeStatus.RESOLVED;
        this.resolvedByAdminId = adminId;
        this.resolvedAt = new Date();
        if (resolutionAmount !== undefined) {
            this.resolutionAmount = resolutionAmount;
        }
        if (notes) {
            this.adminNotes = this.adminNotes
                ? `${this.adminNotes}\n\n[RESOLUTION] ${notes}`
                : `[RESOLUTION] ${notes}`;
        }
        await this.save();
    }
    async close(adminId, notes) {
        if (this.status === DisputeStatus.CLOSED) {
            throw new Error('Dispute is already closed');
        }
        this.status = DisputeStatus.CLOSED;
        this.resolvedByAdminId = adminId;
        this.resolvedAt = new Date();
        if (notes) {
            this.adminNotes = this.adminNotes
                ? `${this.adminNotes}\n\n[CLOSED] ${notes}`
                : `[CLOSED] ${notes}`;
        }
        await this.save();
    }
    getDurationInHours() {
        const endDate = this.resolvedAt || new Date();
        return Math.floor((endDate.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60));
    }
    addEvidenceImage(imageUrl) {
        if (!this.evidenceImages) {
            this.evidenceImages = [];
        }
        this.evidenceImages.push(imageUrl);
    }
    toJSON() {
        const values = { ...this.get() };
        return {
            ...values,
            isOpen: this.isOpen(),
            isResolved: this.isResolved(),
            durationInHours: this.getDurationInHours(),
        };
    }
}
exports.DeliveryDispute = DeliveryDispute;
DeliveryDispute.init({
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
    raisedByUserId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        field: 'raised_by_user_id',
    },
    disputeType: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        field: 'dispute_type',
        validate: {
            isIn: [Object.values(DisputeType)],
        },
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [10, 2000],
        },
    },
    evidenceImages: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        field: 'evidence_images',
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(DisputeStatus)),
        allowNull: false,
        defaultValue: DisputeStatus.OPEN,
    },
    adminNotes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        field: 'admin_notes',
    },
    resolutionAmount: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: true,
        field: 'resolution_amount',
        validate: {
            min: 0,
        },
    },
    resolvedByAdminId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        field: 'resolved_by_admin_id',
    },
    resolvedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'resolved_at',
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
    modelName: 'DeliveryDispute',
    tableName: 'delivery_disputes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['delivery_agreement_id'] },
        { fields: ['raised_by_user_id'] },
        { fields: ['status'] },
        { fields: ['dispute_type'] },
        { fields: ['created_at'] },
    ],
});
exports.default = DeliveryDispute;
//# sourceMappingURL=DeliveryDispute.js.map