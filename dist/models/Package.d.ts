import { Model, Optional } from 'sequelize';
export declare enum PackageSize {
    SMALL = "small",
    MEDIUM = "medium",
    LARGE = "large",
    CUSTOM = "custom"
}
export interface PackageAttributes {
    id: string;
    senderId: string;
    title: string;
    description?: string;
    dimensionsLength?: number;
    dimensionsWidth?: number;
    dimensionsHeight?: number;
    weight?: number;
    packageSize: PackageSize;
    fragile: boolean;
    valuable: boolean;
    specialInstructions?: string;
    pickupAddress: string;
    pickupCoordinates: [number, number];
    pickupContactName?: string;
    pickupContactPhone?: string;
    dropoffAddress: string;
    dropoffCoordinates: [number, number];
    dropoffContactName?: string;
    dropoffContactPhone?: string;
    packageImages?: string[];
    distance?: number;
    senderPriceOffer: number;
    systemSuggestedPrice?: number;
    deliveryTierId?: string;
    requestedDeliveryTime?: Date;
    urgencyLevel?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    demandMultiplierApplied?: number;
    isActive: boolean;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface PackageCreationAttributes extends Optional<PackageAttributes, 'id' | 'description' | 'dimensionsLength' | 'dimensionsWidth' | 'dimensionsHeight' | 'weight' | 'specialInstructions' | 'pickupContactName' | 'pickupContactPhone' | 'dropoffContactName' | 'dropoffContactPhone' | 'packageImages' | 'distance' | 'systemSuggestedPrice' | 'deliveryTierId' | 'requestedDeliveryTime' | 'urgencyLevel' | 'demandMultiplierApplied' | 'expiresAt' | 'createdAt' | 'updatedAt'> {
}
export declare class Package extends Model<PackageAttributes, PackageCreationAttributes> implements PackageAttributes {
    id: string;
    senderId: string;
    title: string;
    description?: string;
    dimensionsLength?: number;
    dimensionsWidth?: number;
    dimensionsHeight?: number;
    weight?: number;
    packageSize: PackageSize;
    fragile: boolean;
    valuable: boolean;
    specialInstructions?: string;
    pickupAddress: string;
    pickupCoordinates: [number, number];
    pickupContactName?: string;
    pickupContactPhone?: string;
    dropoffAddress: string;
    dropoffCoordinates: [number, number];
    dropoffContactName?: string;
    dropoffContactPhone?: string;
    packageImages?: string[];
    distance?: number;
    senderPriceOffer: number;
    systemSuggestedPrice?: number;
    deliveryTierId?: string;
    requestedDeliveryTime?: Date;
    urgencyLevel?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    demandMultiplierApplied?: number;
    isActive: boolean;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    readonly deliveryAgreements?: DeliveryAgreement[];
    readonly images?: PackageImage[];
    isExpired(): boolean;
    calculateVolume(): number | null;
    toJSON(): object;
}
import { DeliveryAgreement } from './DeliveryAgreement';
import { PackageImage } from './PackageImage';
export default Package;
//# sourceMappingURL=Package.d.ts.map