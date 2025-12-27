import { Model, Optional } from 'sequelize';
export declare enum DeliveryTierType {
    LIGHTNING = "lightning",
    EXPRESS = "express",
    STANDARD = "standard",
    ECONOMY = "economy"
}
export interface DeliveryTierAttributes {
    id: string;
    tierType: DeliveryTierType;
    tierName: string;
    description: string;
    maxDeliveryHours: number;
    minDeliveryHours: number;
    basePriceMultiplier: number;
    platformFeePercentage: number;
    slaGuarantee: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
interface DeliveryTierCreationAttributes extends Optional<DeliveryTierAttributes, 'id' | 'createdAt' | 'updatedAt'> {
}
declare class DeliveryTier extends Model<DeliveryTierAttributes, DeliveryTierCreationAttributes> implements DeliveryTierAttributes {
    id: string;
    tierType: DeliveryTierType;
    tierName: string;
    description: string;
    maxDeliveryHours: number;
    minDeliveryHours: number;
    basePriceMultiplier: number;
    platformFeePercentage: number;
    slaGuarantee: number;
    isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    getDeliveryWindow(): string;
    isWithinSLA(deliveryTime: Date, createdTime: Date): boolean;
    calculatePlatformFee(agreedPrice: number): number;
    toJSON(): {
        id: string;
        tierType: DeliveryTierType;
        tierName: string;
        description: string;
        maxDeliveryHours: number;
        minDeliveryHours: number;
        basePriceMultiplier: number;
        platformFeePercentage: number;
        slaGuarantee: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
}
export { DeliveryTier };
export default DeliveryTier;
//# sourceMappingURL=DeliveryTier.d.ts.map