export interface RevenueBreakdown {
    totalRevenue: number;
    commissionRevenue: number;
    subscriptionRevenue: number;
    serviceFeesRevenue: number;
    financialServicesRevenue: number;
    advertisingRevenue: number;
    period: string;
    currency: string;
}
export interface CommissionStructure {
    rideType: 'standard' | 'premium' | 'group' | 'long_distance' | 'delivery';
    baseCommissionRate: number;
    surgeCommissionRate?: number;
    minimumCommission: number;
    maximumCommission?: number;
}
export interface PricingTier {
    name: string;
    monthlyPrice: number;
    annualPrice: number;
    features: string[];
    targetAudience: 'user' | 'driver' | 'business';
}
export interface ServiceFeeStructure {
    baseFee: number;
    bookingFee: number;
    cancellationFee: number;
    surgeSharePercentage: number;
    paymentProcessingRate: number;
}
declare class RevenueService {
    private commissionStructures;
    private subscriptionTiers;
    private serviceFees;
    calculateRideCommission(rideAmount: number, rideType: CommissionStructure['rideType'], isSurge?: boolean, surgeMultiplier?: number): {
        commissionAmount: number;
        commissionRate: number;
        netDriverEarnings: number;
    };
    calculateServiceFees(rideAmount: number, isSubscriber?: boolean, paymentMethod?: 'card' | 'wallet' | 'cash'): {
        baseFee: number;
        bookingFee: number;
        paymentProcessingFee: number;
        totalServiceFees: number;
    };
    calculateRideCostBreakdown(baseFare: number, rideType: CommissionStructure['rideType'], isSurge?: boolean, surgeMultiplier?: number, isSubscriber?: boolean, paymentMethod?: 'card' | 'wallet' | 'cash'): {
        baseFare: number;
        surgeAmount: number;
        totalRideAmount: number;
        serviceFees: any;
        totalCustomerCost: number;
        commission: any;
        platformRevenue: number;
        driverEarnings: number;
    };
    getSubscriptionTiers(targetAudience?: PricingTier['targetAudience']): PricingTier[];
    calculateSubscriptionRevenue(userSubscribers: number, driverSubscribers: number, businessSubscribers: {
        [tierName: string]: number;
    }): {
        monthlyRevenue: number;
        annualRevenue: number;
        breakdown: {
            [tierName: string]: number;
        };
    };
    projectMonthlyRevenue(avgRidesPerDay: number, avgRideValue: number, rideTypeDistribution: {
        [key in CommissionStructure['rideType']]: number;
    }, avgSurgeRate?: number, avgSurgeMultiplier?: number, _subscriberRate?: number): {
        totalRevenue: number;
        commissionRevenue: number;
        serviceFeesRevenue: number;
        breakdown: RevenueBreakdown;
    };
    calculateBreakEven(monthlyOperatingCosts: number, avgRideValue: number, avgCommissionRate?: number): {
        ridesNeededPerDay: number;
        ridesNeededPerMonth: number;
        revenueNeededPerRide: number;
        breakEvenMetrics: {
            daysToBreakEven: number;
            minimumMarketShare: number;
            targetUserBase: number;
        };
    };
    getDynamicPricingRecommendations(currentDemand: number, currentSupply: number, timeOfDay: number, weatherSeverity?: number, eventImpact?: number): {
        recommendedSurgeMultiplier: number;
        reasoning: string[];
        expectedDemandIncrease: number;
        expectedRevenueLift: number;
    };
}
declare const _default: RevenueService;
export default _default;
//# sourceMappingURL=RevenueService.d.ts.map