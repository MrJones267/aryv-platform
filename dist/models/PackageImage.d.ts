import { Model, Optional } from 'sequelize';
export declare enum ImageType {
    PACKAGE = "package",
    PICKUP_PROOF = "pickup_proof",
    DELIVERY_PROOF = "delivery_proof",
    DAMAGE_EVIDENCE = "damage_evidence"
}
export interface PackageImageAttributes {
    id: string;
    packageId: string;
    imageUrl: string;
    imageType: ImageType;
    uploadedByUserId: string;
    uploadedAt: Date;
    metadata?: Record<string, any>;
}
export interface PackageImageCreationAttributes extends Optional<PackageImageAttributes, 'id' | 'metadata'> {
}
export declare class PackageImage extends Model<PackageImageAttributes, PackageImageCreationAttributes> implements PackageImageAttributes {
    id: string;
    packageId: string;
    imageUrl: string;
    imageType: ImageType;
    uploadedByUserId: string;
    uploadedAt: Date;
    metadata?: Record<string, any>;
    readonly package?: Package;
    readonly uploadedByUser?: import('./User').UserModel;
    isRecentUpload(): boolean;
    getFileExtension(): string;
    isValidImageFormat(): boolean;
    getUploadAge(): number;
    addMetadata(key: string, value: any): void;
    toJSON(): object;
}
import { Package } from './Package';
export default PackageImage;
//# sourceMappingURL=PackageImage.d.ts.map