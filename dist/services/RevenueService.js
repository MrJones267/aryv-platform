"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../utils/logger"));
class RevenueService {
    constructor() {
        this.commissionStructures = [
            {
                rideType: 'standard',
                baseCommissionRate: 0.175,
                surgeCommissionRate: 0.20,
                minimumCommission: 1.00,
                maximumCommission: 50.00,
            },
            {
                rideType: 'premium',
                baseCommissionRate: 0.225,
                surgeCommissionRate: 0.25,
                minimumCommission: 2.00,
                maximumCommission: 100.00,
            },
            {
                rideType: 'group',
                baseCommissionRate: 0.15,
                surgeCommissionRate: 0.18,
                minimumCommission: 0.75,
                maximumCommission: 25.00,
            },
            {
                rideType: 'long_distance',
                baseCommissionRate: 0.125,
                surgeCommissionRate: 0.15,
                minimumCommission: 5.00,
                maximumCommission: 200.00,
            },
            {
                rideType: 'delivery',
                baseCommissionRate: 0.25,
                surgeCommissionRate: 0.35,
                minimumCommission: 1.50,
                maximumCommission: 75.00,
            },
        ];
        this.subscriptionTiers = [
            {
                name: 'ARYV Premium',
                monthlyPrice: 9.99,
                annualPrice: 99.00,
                targetAudience: 'user',
                features: [
                    'Priority matching',
                    'Reduced wait times',
                    'Lower service fees (5% vs 10%)',
                    'Advanced AI insights',
                    'Premium customer support',
                    'Ride scheduling',
                    'Price alerts',
                ],
            },
            {
                name: 'ARYV Pro',
                monthlyPrice: 19.99,
                annualPrice: 199.00,
                targetAudience: 'driver',
                features: [
                    'Advanced analytics dashboard',
                    'Route optimization',
                    'Earnings forecasting',
                    'Priority ride assignments',
                    'Marketing tools',
                    'Tax reporting',
                    'Vehicle maintenance tracking',
                ],
            },
            {
                name: 'Business Starter',
                monthlyPrice: 99.00,
                annualPrice: 990.00,
                targetAudience: 'business',
                features: [
                    'Up to 50 employees',
                    'Corporate dashboard',
                    'Expense management',
                    'Bulk booking discounts',
                    'Priority support',
                    'Custom reporting',
                ],
            },
            {
                name: 'Business Professional',
                monthlyPrice: 299.00,
                annualPrice: 2990.00,
                targetAudience: 'business',
                features: [
                    'Up to 200 employees',
                    'Advanced analytics',
                    'API access',
                    'Custom integrations',
                    'Dedicated account manager',
                    'SLA guarantees',
                ],
            },
            {
                name: 'Enterprise',
                monthlyPrice: 499.00,
                annualPrice: 4990.00,
                targetAudience: 'business',
                features: [
                    'Unlimited employees',
                    'White-label options',
                    'Custom development',
                    'On-premise deployment',
                    'Priority development',
                    '24/7 support',
                ],
            },
        ];
        this.serviceFees = {
            baseFee: 2.25,
            bookingFee: 0.75,
            cancellationFee: 5.00,
            surgeSharePercentage: 0.40,
            paymentProcessingRate: 0.029,
        };
    }
    calculateRideCommission(rideAmount, rideType, isSurge = false, surgeMultiplier = 1.0) {
        try {
            const structure = this.commissionStructures.find(s => s.rideType === rideType);
            if (!structure) {
                throw new Error(`Invalid ride type: ${rideType}`);
            }
            const commissionRate = isSurge && structure.surgeCommissionRate
                ? structure.surgeCommissionRate
                : structure.baseCommissionRate;
            let commissionAmount = rideAmount * commissionRate;
            commissionAmount = Math.max(commissionAmount, structure.minimumCommission);
            if (structure.maximumCommission) {
                commissionAmount = Math.min(commissionAmount, structure.maximumCommission);
            }
            if (isSurge && surgeMultiplier > 1.0) {
                const surgeAmount = rideAmount * (surgeMultiplier - 1.0);
                const surgeShare = surgeAmount * this.serviceFees.surgeSharePercentage;
                commissionAmount += surgeShare;
            }
            const netDriverEarnings = rideAmount - commissionAmount;
            return {
                commissionAmount: Math.round(commissionAmount * 100) / 100,
                commissionRate,
                netDriverEarnings: Math.round(netDriverEarnings * 100) / 100,
            };
        }
        catch (error) {
            logger_1.default.error('Error calculating ride commission:', error);
            throw error;
        }
    }
    calculateServiceFees(rideAmount, isSubscriber = false, paymentMethod = 'card') {
        try {
            const baseFee = isSubscriber ? this.serviceFees.baseFee * 0.5 : this.serviceFees.baseFee;
            const bookingFee = this.serviceFees.bookingFee;
            let paymentProcessingFee = 0;
            if (paymentMethod === 'card') {
                paymentProcessingFee = (rideAmount * this.serviceFees.paymentProcessingRate) + 0.30;
            }
            else if (paymentMethod === 'wallet') {
                paymentProcessingFee = rideAmount * 0.015;
            }
            const totalServiceFees = baseFee + bookingFee + paymentProcessingFee;
            return {
                baseFee: Math.round(baseFee * 100) / 100,
                bookingFee: Math.round(bookingFee * 100) / 100,
                paymentProcessingFee: Math.round(paymentProcessingFee * 100) / 100,
                totalServiceFees: Math.round(totalServiceFees * 100) / 100,
            };
        }
        catch (error) {
            logger_1.default.error('Error calculating service fees:', error);
            throw error;
        }
    }
    calculateRideCostBreakdown(baseFare, rideType, isSurge = false, surgeMultiplier = 1.0, isSubscriber = false, paymentMethod = 'card') {
        try {
            const surgeAmount = isSurge ? baseFare * (surgeMultiplier - 1.0) : 0;
            const totalRideAmount = baseFare + surgeAmount;
            const serviceFees = this.calculateServiceFees(totalRideAmount, isSubscriber, paymentMethod);
            const totalCustomerCost = totalRideAmount + serviceFees.totalServiceFees;
            const commission = this.calculateRideCommission(totalRideAmount, rideType, isSurge, surgeMultiplier);
            const platformRevenue = commission.commissionAmount + serviceFees.baseFee + serviceFees.bookingFee;
            const driverEarnings = commission.netDriverEarnings;
            return {
                baseFare: Math.round(baseFare * 100) / 100,
                surgeAmount: Math.round(surgeAmount * 100) / 100,
                totalRideAmount: Math.round(totalRideAmount * 100) / 100,
                serviceFees,
                totalCustomerCost: Math.round(totalCustomerCost * 100) / 100,
                commission,
                platformRevenue: Math.round(platformRevenue * 100) / 100,
                driverEarnings: Math.round(driverEarnings * 100) / 100,
            };
        }
        catch (error) {
            logger_1.default.error('Error calculating ride cost breakdown:', error);
            throw error;
        }
    }
    getSubscriptionTiers(targetAudience) {
        if (targetAudience) {
            return this.subscriptionTiers.filter(tier => tier.targetAudience === targetAudience);
        }
        return this.subscriptionTiers;
    }
    calculateSubscriptionRevenue(userSubscribers, driverSubscribers, businessSubscribers) {
        try {
            let monthlyRevenue = 0;
            const breakdown = {};
            const userTier = this.subscriptionTiers.find(t => t.name === 'ARYV Premium');
            const userMonthlyRevenue = (userSubscribers * 0.7 * userTier.monthlyPrice) +
                (userSubscribers * 0.3 * userTier.annualPrice / 12);
            monthlyRevenue += userMonthlyRevenue;
            breakdown['ARYV Premium'] = userMonthlyRevenue;
            const driverTier = this.subscriptionTiers.find(t => t.name === 'ARYV Pro');
            const driverMonthlyRevenue = (driverSubscribers * 0.6 * driverTier.monthlyPrice) +
                (driverSubscribers * 0.4 * driverTier.annualPrice / 12);
            monthlyRevenue += driverMonthlyRevenue;
            breakdown['ARYV Pro'] = driverMonthlyRevenue;
            Object.entries(businessSubscribers).forEach(([tierName, count]) => {
                const tier = this.subscriptionTiers.find(t => t.name === tierName);
                if (tier) {
                    const tierMonthlyRevenue = (count * 0.8 * tier.monthlyPrice) +
                        (count * 0.2 * tier.annualPrice / 12);
                    monthlyRevenue += tierMonthlyRevenue;
                    breakdown[tierName] = tierMonthlyRevenue;
                }
            });
            return {
                monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
                annualRevenue: Math.round(monthlyRevenue * 12 * 100) / 100,
                breakdown,
            };
        }
        catch (error) {
            logger_1.default.error('Error calculating subscription revenue:', error);
            throw error;
        }
    }
    projectMonthlyRevenue(avgRidesPerDay, avgRideValue, rideTypeDistribution, avgSurgeRate = 0.15, avgSurgeMultiplier = 1.3, _subscriberRate = 0.05) {
        try {
            const totalMonthlyRides = avgRidesPerDay * 30;
            let totalCommissionRevenue = 0;
            let totalServiceFeesRevenue = 0;
            Object.entries(rideTypeDistribution).forEach(([rideType, percentage]) => {
                const ridesOfType = totalMonthlyRides * percentage;
                const surgeRides = ridesOfType * avgSurgeRate;
                const normalRides = ridesOfType - surgeRides;
                const normalCommission = this.calculateRideCommission(avgRideValue, rideType, false);
                totalCommissionRevenue += normalRides * normalCommission.commissionAmount;
                const surgeCommission = this.calculateRideCommission(avgRideValue, rideType, true, avgSurgeMultiplier);
                totalCommissionRevenue += surgeRides * surgeCommission.commissionAmount;
                const serviceFees = this.calculateServiceFees(avgRideValue, false);
                totalServiceFeesRevenue += ridesOfType * serviceFees.totalServiceFees;
            });
            const subscriptionRevenue = totalCommissionRevenue * 0.214;
            const financialServicesRevenue = totalCommissionRevenue * 0.043;
            const advertisingRevenue = totalCommissionRevenue * 0.029;
            const totalRevenue = totalCommissionRevenue + totalServiceFeesRevenue +
                subscriptionRevenue + financialServicesRevenue + advertisingRevenue;
            const breakdown = {
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                commissionRevenue: Math.round(totalCommissionRevenue * 100) / 100,
                subscriptionRevenue: Math.round(subscriptionRevenue * 100) / 100,
                serviceFeesRevenue: Math.round(totalServiceFeesRevenue * 100) / 100,
                financialServicesRevenue: Math.round(financialServicesRevenue * 100) / 100,
                advertisingRevenue: Math.round(advertisingRevenue * 100) / 100,
                period: 'monthly',
                currency: 'USD',
            };
            return {
                totalRevenue: breakdown.totalRevenue,
                commissionRevenue: breakdown.commissionRevenue,
                serviceFeesRevenue: breakdown.serviceFeesRevenue,
                breakdown,
            };
        }
        catch (error) {
            logger_1.default.error('Error projecting monthly revenue:', error);
            throw error;
        }
    }
    calculateBreakEven(monthlyOperatingCosts, avgRideValue, avgCommissionRate = 0.175) {
        try {
            const avgCommissionPerRide = avgRideValue * avgCommissionRate;
            const avgServiceFeePerRide = this.serviceFees.baseFee + this.serviceFees.bookingFee;
            const revenuePerRide = avgCommissionPerRide + avgServiceFeePerRide;
            const ridesNeededPerMonth = Math.ceil(monthlyOperatingCosts / revenuePerRide);
            const ridesNeededPerDay = Math.ceil(ridesNeededPerMonth / 30);
            const targetUserBase = Math.ceil(ridesNeededPerDay / 0.05);
            return {
                ridesNeededPerDay,
                ridesNeededPerMonth,
                revenueNeededPerRide: Math.round(revenuePerRide * 100) / 100,
                breakEvenMetrics: {
                    daysToBreakEven: Math.ceil(monthlyOperatingCosts / (ridesNeededPerDay * revenuePerRide)),
                    minimumMarketShare: 0.01,
                    targetUserBase,
                },
            };
        }
        catch (error) {
            logger_1.default.error('Error calculating break-even analysis:', error);
            throw error;
        }
    }
    getDynamicPricingRecommendations(currentDemand, currentSupply, timeOfDay, weatherSeverity = 0, eventImpact = 0) {
        try {
            const supplyDemandRatio = currentSupply / Math.max(currentDemand, 1);
            let surgeMultiplier = 1.0;
            const reasoning = [];
            if (supplyDemandRatio < 0.5) {
                surgeMultiplier = 2.0;
                reasoning.push('Very high demand relative to supply');
            }
            else if (supplyDemandRatio < 0.7) {
                surgeMultiplier = 1.5;
                reasoning.push('High demand relative to supply');
            }
            else if (supplyDemandRatio < 0.9) {
                surgeMultiplier = 1.2;
                reasoning.push('Moderate demand relative to supply');
            }
            if (timeOfDay >= 7 && timeOfDay <= 9 || timeOfDay >= 17 && timeOfDay <= 19) {
                surgeMultiplier *= 1.2;
                reasoning.push('Peak hours adjustment');
            }
            if (weatherSeverity > 0.5) {
                surgeMultiplier *= (1 + weatherSeverity * 0.4);
                reasoning.push('Weather impact adjustment');
            }
            if (eventImpact > 0.3) {
                surgeMultiplier *= (1 + eventImpact * 0.3);
                reasoning.push('Local events impact');
            }
            surgeMultiplier = Math.min(surgeMultiplier, 3.0);
            const expectedDemandIncrease = Math.max(0, (1.0 - surgeMultiplier) * 0.3);
            const expectedRevenueLift = (surgeMultiplier - 1.0) * 0.6;
            return {
                recommendedSurgeMultiplier: Math.round(surgeMultiplier * 100) / 100,
                reasoning,
                expectedDemandIncrease: Math.round(expectedDemandIncrease * 100) / 100,
                expectedRevenueLift: Math.round(expectedRevenueLift * 100) / 100,
            };
        }
        catch (error) {
            logger_1.default.error('Error calculating dynamic pricing recommendations:', error);
            throw error;
        }
    }
}
exports.default = new RevenueService();
//# sourceMappingURL=RevenueService.js.map