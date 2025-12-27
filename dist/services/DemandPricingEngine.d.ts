import { DemandMetrics } from '../models/DemandMetrics';
import { DeliveryTierType } from '../models/DeliveryTier';
import { PackageSize } from '../models/Package';
export interface PricingSuggestion {
    tierType: DeliveryTierType;
    basePrice: number;
    demandMultiplier: number;
    finalPrice: number;
    platformFee: number;
    courierEarnings: number;
    estimatedDeliveryTime: string;
    demandLevel: 'LOW' | 'NORMAL' | 'HIGH' | 'SURGE';
}
export interface LocationDemand {
    locationHash: string;
    availableCouriers: number;
    activeDemand: number;
    demandMultiplier: number;
    lastUpdated: Date;
}
export declare class DemandPricingEngine {
    private static instance;
    private readonly BASE_PRICES;
    private readonly PACKAGE_SIZE_MULTIPLIERS;
    private readonly DISTANCE_RATE_PER_KM;
    private readonly FRAGILE_SURCHARGE;
    private readonly VALUABLE_SURCHARGE;
    static getInstance(): DemandPricingEngine;
    calculatePricingSuggestions(pickupCoordinates: [number, number], _dropoffCoordinates: [number, number], packageSize: PackageSize, distance: number, isFragile?: boolean, isValuable?: boolean, requestedDeliveryTime?: Date): Promise<PricingSuggestion[]>;
    private calculateTierPricing;
    private calculateUrgencyMultiplier;
    updateDemandMetrics(coordinates: [number, number], forceUpdate?: boolean): Promise<DemandMetrics>;
    private calculateCurrentMetrics;
    private getCurrentDemandMetrics;
    private generateLocationHash;
    getLocationDemands(locations: [number, number][]): Promise<LocationDemand[]>;
    initializeDefaultTiers(): Promise<void>;
}
export default DemandPricingEngine;
//# sourceMappingURL=DemandPricingEngine.d.ts.map