/**
 * @fileoverview PackageImage model for package documentation
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Image type enum
export enum ImageType {
  PACKAGE = 'package',
  PICKUP_PROOF = 'pickup_proof',
  DELIVERY_PROOF = 'delivery_proof',
  DAMAGE_EVIDENCE = 'damage_evidence'
}

// PackageImage interface
export interface PackageImageAttributes {
  id: string;
  packageId: string;
  imageUrl: string;
  imageType: ImageType;
  uploadedByUserId: string;
  uploadedAt: Date;
  metadata?: Record<string, any>;
}

export interface PackageImageCreationAttributes extends Optional<PackageImageAttributes,
  'id' | 'metadata'
> {}

export class PackageImage extends Model<PackageImageAttributes, PackageImageCreationAttributes>
  implements PackageImageAttributes {

  public id!: string;
  public packageId!: string;
  public imageUrl!: string;
  public imageType!: ImageType;
  public uploadedByUserId!: string;
  public uploadedAt!: Date;
  public metadata?: Record<string, any>;

  // Associations
  public readonly package?: Package;
  public readonly uploadedByUser?: import('./User').UserModel;

  // Methods
  public isRecentUpload(): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.uploadedAt > oneHourAgo;
  }

  public getFileExtension(): string {
    const url = this.imageUrl;
    const extension = url.split('.').pop();
    return extension ? extension.toLowerCase() : '';
  }

  public isValidImageFormat(): boolean {
    const validFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    return validFormats.includes(this.getFileExtension());
  }

  public getUploadAge(): number {
    return Date.now() - this.uploadedAt.getTime();
  }

  public addMetadata(key: string, value: any): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata[key] = value;
  }

  public override toJSON(): object {
    const values = { ...this.get() };
    return {
      ...values,
      isRecent: this.isRecentUpload(),
      fileExtension: this.getFileExtension(),
      uploadAgeInMinutes: Math.floor(this.getUploadAge() / (1000 * 60)),
    };
  }
}

PackageImage.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  packageId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'packages',
      key: 'id',
    },
    field: 'package_id',
  },
  imageUrl: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'image_url',
    validate: {
      isUrl: true,
    },
  },
  imageType: {
    type: DataTypes.ENUM(...Object.values(ImageType)),
    allowNull: false,
    defaultValue: ImageType.PACKAGE,
    field: 'image_type',
  },
  uploadedByUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    field: 'uploaded_by_user_id',
  },
  uploadedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'uploaded_at',
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  sequelize,
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

// Import these to avoid circular dependencies - will be set up in index.ts
import { Package } from './Package';

export default PackageImage;
