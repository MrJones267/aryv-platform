/**
 * @fileoverview Revenue Management Service for ARYV Platform
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

// import { Sequelize, Op } from 'sequelize'; // Unused imports removed
import logger from '../utils/logger';

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

class RevenueService {
  private commissionStructures: CommissionStructure[] = [
    {
      rideType: 'standard',
      baseCommissionRate: 0.175, // 17.5%
      surgeCommissionRate: 0.20, // 20% during surge
      minimumCommission: 1.00,
      maximumCommission: 50.00,
    },
    {
      rideType: 'premium',
      baseCommissionRate: 0.225, // 22.5%
      surgeCommissionRate: 0.25, // 25% during surge
      minimumCommission: 2.00,
      maximumCommission: 100.00,
    },
    {
      rideType: 'group',
      baseCommissionRate: 0.15, // 15%
      surgeCommissionRate: 0.18, // 18% during surge
      minimumCommission: 0.75,
      maximumCommission: 25.00,
    },
    {
      rideType: 'long_distance',
      baseCommissionRate: 0.125, // 12.5%
      surgeCommissionRate: 0.15, // 15% during surge
      minimumCommission: 5.00,
      maximumCommission: 200.00,
    },
    {
      rideType: 'delivery',
      baseCommissionRate: 0.25, // 25%
      surgeCommissionRate: 0.35, // 35% during high demand
      minimumCommission: 1.50,
      maximumCommission: 75.00,
    },
  ];

  private subscriptionTiers: PricingTier[] = [
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

  private serviceFees: ServiceFeeStructure = {
    baseFee: 2.25,
    bookingFee: 0.75,
    cancellationFee: 5.00,
    surgeSharePercentage: 0.40, // 40% of surge premium
    paymentProcessingRate: 0.029, // 2.9% + $0.30
  };

  /**
   * Calculate commission for a ride
   */
  calculateRideCommission(
    rideAmount: number,
    rideType: CommissionStructure['rideType'],
    isSurge: boolean = false,
    surgeMultiplier: number = 1.0,
  ): {
    commissionAmount: number;
    commissionRate: number;
    netDriverEarnings: number;
  } {
    try {
      const structure = this.commissionStructures.find(s => s.rideType === rideType);
      if (!structure) {
        throw new Error(`Invalid ride type: ${rideType}`);
      }

      const commissionRate = isSurge && structure.surgeCommissionRate
        ? structure.surgeCommissionRate
        : structure.baseCommissionRate;

      let commissionAmount = rideAmount * commissionRate;

      // Apply minimum and maximum limits
      commissionAmount = Math.max(commissionAmount, structure.minimumCommission);
      if (structure.maximumCommission) {
        commissionAmount = Math.min(commissionAmount, structure.maximumCommission);
      }

      // Add surge premium share
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

    } catch (error) {
      logger.error('Error calculating ride commission:', error);
      throw error;
    }
  }

  /**
   * Calculate service fees for a ride
   */
  calculateServiceFees(
    rideAmount: number,
    isSubscriber: boolean = false,
    paymentMethod: 'card' | 'wallet' | 'cash' = 'card',
  ): {
    baseFee: number;
    bookingFee: number;
    paymentProcessingFee: number;
    totalServiceFees: number;
  } {
    try {
      // Reduced fees for subscribers
      const baseFee = isSubscriber ? this.serviceFees.baseFee * 0.5 : this.serviceFees.baseFee;
      const bookingFee = this.serviceFees.bookingFee;

      // Payment processing fees
      let paymentProcessingFee = 0;
      if (paymentMethod === 'card') {
        paymentProcessingFee = (rideAmount * this.serviceFees.paymentProcessingRate) + 0.30;
      } else if (paymentMethod === 'wallet') {
        paymentProcessingFee = rideAmount * 0.015; // 1.5% for digital wallet
      }
      // Cash has no processing fee

      const totalServiceFees = baseFee + bookingFee + paymentProcessingFee;

      return {
        baseFee: Math.round(baseFee * 100) / 100,
        bookingFee: Math.round(bookingFee * 100) / 100,
        paymentProcessingFee: Math.round(paymentProcessingFee * 100) / 100,
        totalServiceFees: Math.round(totalServiceFees * 100) / 100,
      };

    } catch (error) {
      logger.error('Error calculating service fees:', error);
      throw error;
    }
  }

  /**
   * Calculate total ride cost breakdown
   */
  calculateRideCostBreakdown(
    baseFare: number,
    rideType: CommissionStructure['rideType'],
    isSurge: boolean = false,
    surgeMultiplier: number = 1.0,
    isSubscriber: boolean = false,
    paymentMethod: 'card' | 'wallet' | 'cash' = 'card',
  ): {
    baseFare: number;
    surgeAmount: number;
    totalRideAmount: number;
    serviceFees: any;
    totalCustomerCost: number;
    commission: any;
    platformRevenue: number;
    driverEarnings: number;
  } {
    try {
      // Calculate surge amount
      const surgeAmount = isSurge ? baseFare * (surgeMultiplier - 1.0) : 0;
      const totalRideAmount = baseFare + surgeAmount;

      // Calculate service fees
      const serviceFees = this.calculateServiceFees(totalRideAmount, isSubscriber, paymentMethod);

      // Total customer cost
      const totalCustomerCost = totalRideAmount + serviceFees.totalServiceFees;

      // Calculate commission
      const commission = this.calculateRideCommission(totalRideAmount, rideType, isSurge, surgeMultiplier);

      // Platform revenue (commission + service fees - payment processing)
      const platformRevenue = commission.commissionAmount + serviceFees.baseFee + serviceFees.bookingFee;

      // Driver earnings
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

    } catch (error) {
      logger.error('Error calculating ride cost breakdown:', error);
      throw error;
    }
  }

  /**
   * Get subscription pricing tiers
   */
  getSubscriptionTiers(targetAudience?: PricingTier['targetAudience']): PricingTier[] {
    if (targetAudience) {
      return this.subscriptionTiers.filter(tier => tier.targetAudience === targetAudience);
    }
    return this.subscriptionTiers;
  }

  /**
   * Calculate subscription revenue projection
   */
  calculateSubscriptionRevenue(
    userSubscribers: number,
    driverSubscribers: number,
    businessSubscribers: { [tierName: string]: number },
  ): {
    monthlyRevenue: number;
    annualRevenue: number;
    breakdown: { [tierName: string]: number };
  } {
    try {
      let monthlyRevenue = 0;
      const breakdown: { [tierName: string]: number } = {};

      // User subscriptions (assuming 70% monthly, 30% annual)
      const userTier = this.subscriptionTiers.find(t => t.name === 'ARYV Premium')!;
      const userMonthlyRevenue = (userSubscribers * 0.7 * userTier.monthlyPrice) +
                                 (userSubscribers * 0.3 * userTier.annualPrice / 12);
      monthlyRevenue += userMonthlyRevenue;
      breakdown['ARYV Premium'] = userMonthlyRevenue;

      // Driver subscriptions (assuming 60% monthly, 40% annual)
      const driverTier = this.subscriptionTiers.find(t => t.name === 'ARYV Pro')!;
      const driverMonthlyRevenue = (driverSubscribers * 0.6 * driverTier.monthlyPrice) +
                                   (driverSubscribers * 0.4 * driverTier.annualPrice / 12);
      monthlyRevenue += driverMonthlyRevenue;
      breakdown['ARYV Pro'] = driverMonthlyRevenue;

      // Business subscriptions
      Object.entries(businessSubscribers).forEach(([tierName, count]) => {
        const tier = this.subscriptionTiers.find(t => t.name === tierName);
        if (tier) {
          // Assuming 80% monthly, 20% annual for business
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

    } catch (error) {
      logger.error('Error calculating subscription revenue:', error);
      throw error;
    }
  }

  /**
   * Project monthly revenue based on ride volume
   */
  projectMonthlyRevenue(
    avgRidesPerDay: number,
    avgRideValue: number,
    rideTypeDistribution: { [key in CommissionStructure['rideType']]: number },
    avgSurgeRate: number = 0.15, // 15% of rides are surge
    avgSurgeMultiplier: number = 1.3,
    _subscriberRate: number = 0.05, // 5% of users are subscribers
  ): {
    totalRevenue: number;
    commissionRevenue: number;
    serviceFeesRevenue: number;
    breakdown: RevenueBreakdown;
  } {
    try {
      const totalMonthlyRides = avgRidesPerDay * 30;
      let totalCommissionRevenue = 0;
      let totalServiceFeesRevenue = 0;

      // Calculate revenue by ride type
      Object.entries(rideTypeDistribution).forEach(([rideType, percentage]) => {
        const ridesOfType = totalMonthlyRides * percentage;
        const surgeRides = ridesOfType * avgSurgeRate;
        const normalRides = ridesOfType - surgeRides;

        // Normal rides
        const normalCommission = this.calculateRideCommission(
          avgRideValue,
          rideType as CommissionStructure['rideType'],
          false,
        );
        totalCommissionRevenue += normalRides * normalCommission.commissionAmount;

        // Surge rides
        const surgeCommission = this.calculateRideCommission(
          avgRideValue,
          rideType as CommissionStructure['rideType'],
          true,
          avgSurgeMultiplier,
        );
        totalCommissionRevenue += surgeRides * surgeCommission.commissionAmount;

        // Service fees
        const serviceFees = this.calculateServiceFees(avgRideValue, false);
        totalServiceFeesRevenue += ridesOfType * serviceFees.totalServiceFees;
      });

      // Estimate other revenue streams (as percentages of commission revenue)
      const subscriptionRevenue = totalCommissionRevenue * 0.214; // 15/70 ratio
      const financialServicesRevenue = totalCommissionRevenue * 0.043; // 3/70 ratio
      const advertisingRevenue = totalCommissionRevenue * 0.029; // 2/70 ratio

      const totalRevenue = totalCommissionRevenue + totalServiceFeesRevenue +
                          subscriptionRevenue + financialServicesRevenue + advertisingRevenue;

      const breakdown: RevenueBreakdown = {
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

    } catch (error) {
      logger.error('Error projecting monthly revenue:', error);
      throw error;
    }
  }

  /**
   * Calculate break-even analysis
   */
  calculateBreakEven(
    monthlyOperatingCosts: number,
    avgRideValue: number,
    avgCommissionRate: number = 0.175,
  ): {
    ridesNeededPerDay: number;
    ridesNeededPerMonth: number;
    revenueNeededPerRide: number;
    breakEvenMetrics: {
      daysToBreakEven: number;
      minimumMarketShare: number;
      targetUserBase: number;
    };
  } {
    try {
      const avgCommissionPerRide = avgRideValue * avgCommissionRate;
      const avgServiceFeePerRide = this.serviceFees.baseFee + this.serviceFees.bookingFee;
      const revenuePerRide = avgCommissionPerRide + avgServiceFeePerRide;

      const ridesNeededPerMonth = Math.ceil(monthlyOperatingCosts / revenuePerRide);
      const ridesNeededPerDay = Math.ceil(ridesNeededPerMonth / 30);

      // Assuming 5% of users take rides daily, 20% weekly
      const targetUserBase = Math.ceil(ridesNeededPerDay / 0.05);

      return {
        ridesNeededPerDay,
        ridesNeededPerMonth,
        revenueNeededPerRide: Math.round(revenuePerRide * 100) / 100,
        breakEvenMetrics: {
          daysToBreakEven: Math.ceil(monthlyOperatingCosts / (ridesNeededPerDay * revenuePerRide)),
          minimumMarketShare: 0.01, // Estimate 1% market share needed
          targetUserBase,
        },
      };

    } catch (error) {
      logger.error('Error calculating break-even analysis:', error);
      throw error;
    }
  }

  /**
   * Get dynamic pricing recommendations
   */
  getDynamicPricingRecommendations(
    currentDemand: number,
    currentSupply: number,
    timeOfDay: number,
    weatherSeverity: number = 0,
    eventImpact: number = 0,
  ): {
    recommendedSurgeMultiplier: number;
    reasoning: string[];
    expectedDemandIncrease: number;
    expectedRevenueLift: number;
  } {
    try {
      const supplyDemandRatio = currentSupply / Math.max(currentDemand, 1);
      let surgeMultiplier = 1.0;
      const reasoning: string[] = [];

      // Base surge calculation
      if (supplyDemandRatio < 0.5) {
        surgeMultiplier = 2.0;
        reasoning.push('Very high demand relative to supply');
      } else if (supplyDemandRatio < 0.7) {
        surgeMultiplier = 1.5;
        reasoning.push('High demand relative to supply');
      } else if (supplyDemandRatio < 0.9) {
        surgeMultiplier = 1.2;
        reasoning.push('Moderate demand relative to supply');
      }

      // Time-based adjustments
      if (timeOfDay >= 7 && timeOfDay <= 9 || timeOfDay >= 17 && timeOfDay <= 19) {
        surgeMultiplier *= 1.2;
        reasoning.push('Peak hours adjustment');
      }

      // Weather adjustments
      if (weatherSeverity > 0.5) {
        surgeMultiplier *= (1 + weatherSeverity * 0.4);
        reasoning.push('Weather impact adjustment');
      }

      // Event adjustments
      if (eventImpact > 0.3) {
        surgeMultiplier *= (1 + eventImpact * 0.3);
        reasoning.push('Local events impact');
      }

      // Cap surge at 3.0x
      surgeMultiplier = Math.min(surgeMultiplier, 3.0);

      // Estimate impact
      const expectedDemandIncrease = Math.max(0, (1.0 - surgeMultiplier) * 0.3); // Demand drops with price
      const expectedRevenueLift = (surgeMultiplier - 1.0) * 0.6; // Revenue increases with surge

      return {
        recommendedSurgeMultiplier: Math.round(surgeMultiplier * 100) / 100,
        reasoning,
        expectedDemandIncrease: Math.round(expectedDemandIncrease * 100) / 100,
        expectedRevenueLift: Math.round(expectedRevenueLift * 100) / 100,
      };

    } catch (error) {
      logger.error('Error calculating dynamic pricing recommendations:', error);
      throw error;
    }
  }
}

export default new RevenueService();
