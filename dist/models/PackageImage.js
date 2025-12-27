"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageImage = exports.ImageType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var ImageType;
(function (ImageType) {
    ImageType["PACKAGE"] = "package";
    ImageType["PICKUP_PROOF"] = "pickup_proof";
    ImageType["DELIVERY_PROOF"] = "delivery_proof";
    ImageType["DAMAGE_EVIDENCE"] = "damage_evidence";
})(ImageType || (exports.ImageType = ImageType = {}));
class PackageImage extends sequelize_1.Model {
    isRecentUpload() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return this.uploadedAt > oneHourAgo;
    }
    getFileExtension() {
        const url = this.imageUrl;
        const extension = url.split('.').pop();
        return extension ? extension.toLowerCase() : '';
    }
    isValidImageFormat() {
        const validFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        return validFormats.includes(this.getFileExtension());
    }
    getUploadAge() {
        return Date.now() - this.uploadedAt.getTime();
    }
    addMetadata(key, value) {
        if (!this.metadata) {
            this.metadata = {};
        }
        this.metadata[key] = value;
    }
    toJSON() {
        const values = { ...this.get() };
        return {
            ...values,
            isRecent: this.isRecentUpload(),
            fileExtension: this.getFileExtension(),
            uploadAgeInMinutes: Math.floor(this.getUploadAge() / (1000 * 60)),
        };
    }
}
exports.PackageImage = PackageImage;
PackageImage.init({
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
    imageUrl: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: false,
        field: 'image_url',
        validate: {
            isUrl: true,
        },
    },
    imageType: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(ImageType)),
        allowNull: false,
        defaultValue: ImageType.PACKAGE,
        field: 'image_type',
    },
    uploadedByUserId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        field: 'uploaded_by_user_id',
    },
    uploadedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'uploaded_at',
    },
    metadata: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
    },
}, {
    sequelize: database_1.sequelize,
    modelName: 'PackageImage',
    tableName: 'package_images',
    timestamps: false,
    indexes: [
        { fields: ['package_id'] },
        { fields: ['image_type'] },
        { fields: ['uploaded_by_user_id'] },
        { fields: ['uploaded_at'] },
    ],
});
exports.default = PackageImage;
//# sourceMappingURL=PackageImage.js.map