import { Model, Optional } from 'sequelize';
import { PackageSize } from './Package';
export interface CourierProfileAttributes {
    id: string;
    userId: string;
    isCourierActive: boolean;
    courierRating: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    totalCourierEarnings: number;
    preferredPackageSizes: PackageSize[];
    maxPackageWeight?: number;
    deliveryRadius?: number;
    isAvailableForDeliveries: boolean;
    verificationDocuments?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface CourierProfileCreationAttributes extends Optional<CourierProfileAttributes, 'id' | 'maxPackageWeight' | 'deliveryRadius' | 'verificationDocuments' | 'createdAt' | 'updatedAt'> {
}
export declare class CourierProfile extends Model<CourierProfileAttributes, CourierProfileCreationAttributes> implements CourierProfileAttributes {
    id: string;
    userId: string;
    isCourierActive: boolean;
    courierRating: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    totalCourierEarnings: number;
    preferredPackageSizes: PackageSize[];
    maxPackageWeight?: number;
    deliveryRadius?: number;
    isAvailableForDeliveries: boolean;
    verificationDocuments?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    readonly user?: import('./User').UserModel;
    readonly deliveryAgreements?: DeliveryAgreement[];
    getSuccessRate(): number;
    canHandlePackage(packageSize: PackageSize, weight?: number): boolean;
    updateRating(newRating: number): Promise<void>;
    recordSuccessfulDelivery(earnings: number): Promise<void>;
    toJSON(): object;
}
import { DeliveryAgreement } from './DeliveryAgreement';
export default CourierProfile;
//# sourceMappingURL=CourierProfile.d.ts.map