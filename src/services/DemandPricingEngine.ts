/**
 * @fileoverview Demand-based pricing engine for dynamic courier pricing
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DemandMetrics } from '../models/DemandMetrics';
import { DeliveryTier, DeliveryTierType } from '../models/DeliveryTier';
import { Package, PackageSize } from '../models/Package';
import { CourierProfile } from '../models/CourierProfile';
import { sequelize } from '../config/database';
import { Op } from 'sequelize';

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

export class DemandPricingEngine {
  private static instance: DemandPricingEngine;

  // Base pricing configuration
  private readonly BASE_PRICES = {
    [DeliveryTierType.LIGHTNING]: 50.0,  // Base price for 1-2hr delivery
    [DeliveryTierType.EXPRESS]: 35.0,    // Base price for 2-4hr delivery
    [DeliveryTierType.STANDARD]: 25.0,   // Base price for 4-8hr delivery
    [DeliveryTierType.ECONOMY]: 18.0,     // Base price for 8-12hr delivery
  };

  private readonly PACKAGE_SIZE_MULTIPLIERS = {
    [PackageSize.SMALL]: 1.0,
    [PackageSize.MEDIUM]: 1.2,
    [PackageSize.LARGE]: 1.5,
    [PackageSize.CUSTOM]: 2.0,
  };

  private readonly DISTANCE_RATE_PER_KM = 1.25; // Additional cost per km
  private readonly FRAGILE_SURCHARGE = 5.0;
  private readonly VALUABLE_SURCHARGE = 10.0;

  public static getInstance(): DemandPricingEngine {
    if (!DemandPricingEngine.instance) {
      DemandPricingEngine.instance = new DemandPricingEngine();
    }
    return DemandPricingEngine.instance;
  }

  /**
   * Calculate pricing suggestions for all delivery tiers
   */
  async calculatePricingSuggestions(
    pickupCoordinates: [number, number],
    _dropoffCoordinates: [number, number],
    packageSize: PackageSize,
    distance: number,
    isFragile: boolean = false,
    isValuable: boolean = false,
    requestedDeliveryTime?: Date,
  ): Promise<PricingSuggestion[]> {
    try {
      // Get current demand metrics for pickup location
      const locationHash = this.generateLocationHash(pickupCoordinates);
      const demandMetrics = await this.getCurrentDemandMetrics(locationHash);

      // Get all active delivery tiers
      const deliveryTiers = await DeliveryTier.findAll({
        where: { isActive: true },
        order: [['minDeliveryHours', 'ASC']],
      });

      const suggestions: PricingSuggestion[] = [];

      for (const tier of deliveryTiers) {
        const suggestion = await this.calculateTierPricing(
          tier,
          distance,
          packageSize,
          isFragile,
          isValuable,
          demandMetrics,
          requestedDeliveryTime,
        );
        suggestions.push(suggestion);
      }

      return suggestions;
    } catch (error) {
      console.error('[DemandPricingEngine] Error calculating pricing suggestions:', error);
      throw new Error('Failed to calculate pricing suggestions');
    }
  }

  /**
   * Calculate pricing for a specific delivery tier
   */
  private async calculateTierPricing(
    tier: DeliveryTier,
    distance: number,
    packageSize: PackageSize,
    isFragile: boolean,
    isValuable: boolean,
    demandMetrics: DemandMetrics | null,
    requestedDeliveryTime?: Date,
  ): Promise<PricingSuggestion> {
    // Base price calculation
    let basePrice = this.BASE_PRICES[tier.tierType] || 25.0;

    // Distance-based pricing
    basePrice += distance * this.DISTANCE_RATE_PER_KM;

    // Package size multiplier
    basePrice *= this.PACKAGE_SIZE_MULTIPLIERS[packageSize] || 1.0;

    // Special handling surcharges
    if (isFragile) basePrice += this.FRAGILE_SURCHARGE;
    if (isValuable) basePrice += this.VALUABLE_SURCHARGE;

    // Apply tier base multiplier
    basePrice *= tier.basePriceMultiplier;

    // Apply demand multiplier
    const demandMultiplier = demandMetrics?.demandMultiplier || 1.0;

    // Apply urgency multiplier if delivery is requested soon
    const urgencyMultiplier = this.calculateUrgencyMultiplier(
      tier,
      requestedDeliveryTime,
    );

    const finalPrice = basePrice * demandMultiplier * urgencyMultiplier;
    const platformFee = tier.calculatePlatformFee(finalPrice);
    const courierEarnings = finalPrice - platformFee;

    return {
      tierType: tier.tierType,
      basePrice: Math.round(basePrice * 100) / 100,
      demandMultiplier: Math.round(demandMultiplier * 100) / 100,
      finalPrice: Math.round(finalPrice * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      courierEarnings: Math.round(courierEarnings * 100) / 100,
      estimatedDeliveryTime: tier.getDeliveryWindow(),
      demandLevel: demandMetrics?.getDemandLevel() || 'NORMAL',
    };
  }

  /**
   * Calculate urgency multiplier based on requested delivery time
   */
  private calculateUrgencyMultiplier(
    tier: DeliveryTier,
    requestedDeliveryTime?: Date,
  ): number {
    if (!requestedDeliveryTime) return 1.0;

    const now = new Date();
    const hoursUntilRequested = (requestedDeliveryTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // If requested time is less than tier minimum, apply urgency multiplier
    if (hoursUntilRequested < tier.minDeliveryHours) {
      if (hoursUntilRequested <= 0.5) return 2.0; // ASAP requests
      if (hoursUntilRequested <= 1.0) return 1.5; // Very urgent
      return 1.25; // Somewhat urgent
    }

    return 1.0; // Normal timing
  }

  /**
   * Update demand metrics for a specific location
   */
  async updateDemandMetrics(
    coordinates: [number, number],
    forceUpdate: boolean = false,
  ): Promise<DemandMetrics> {
    try {
      const locationHash = this.generateLocationHash(coordinates);
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0); // Round to hour

      // Check if we have recent data
      const existingMetrics = await DemandMetrics.findOne({
        where: {
          locationHash,
          timeSlot: currentHour,
        },
      });

      if (existingMetrics && !forceUpdate && existingMetrics.isDataFresh(15)) {
        return existingMetrics;
      }

      // Calculate current metrics
      const metrics = await this.calculateCurrentMetrics(locationHash, coordinates);

      if (existingMetrics) {
        // Update existing record
        await existingMetrics.update({
          ...metrics,
          calculatedAt: new Date(),
        });
        return existingMetrics;
      } else {
        // Create new record
        return await (DemandMetrics as any).create({
          locationHash,
          timeSlot: currentHour,
          calculatedAt: new Date(),
          ...metrics,
        });
      }
    } catch (error) {
      console.error('[DemandPricingEngine] Error updating demand metrics:', error);
      throw new Error('Failed to update demand metrics');
    }
  }

  /**
   * Calculate current demand metrics for a location
   */
  private async calculateCurrentMetrics(
    _locationHash: string,
    coordinates: [number, number],
  ): Promise<Partial<DemandMetrics>> {
    const [lng, lat] = coordinates;
    const radiusKm = 20; // 20km radius for demand calculation

    // Count available couriers in the area
    const availableCouriers = await (CourierProfile as any).count({
      where: {
        isCourierActive: true,
        isAvailable: true,
      },
      include: [{
        model: sequelize.models['User'],
        where: sequelize.literal(`
          ST_DWithin(
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            last_known_location::geography,
            ${radiusKm * 1000}
          )
        `),
      }],
    });

    // Count active package requests in the area
    const activeDemand = await Package.count({
      where: {
        isActive: true,
        [Op.or]: [
          { expiresAt: { [Op.is]: undefined } },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
        [Op.and]: [
          sequelize.literal(`
            ST_DWithin(
              pickup_coordinates::geography,
              ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
              ${radiusKm * 1000}
            )
          `),
        ],
      },
    });

    // Calculate completed deliveries in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const completedDeliveries = await sequelize.models['DeliveryAgreement'].count({
      where: {
        status: 'completed',
        deliveryConfirmedAt: { [Op.gte]: oneHourAgo },
      },
      include: [{
        model: Package,
        where: sequelize.literal(`
          ST_DWithin(
            pickup_coordinates::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radiusKm * 1000}
          )
        `),
      }],
    });

    // Calculate demand multiplier
    const supplyDemandRatio = activeDemand > 0 ? Number(availableCouriers) / Number(activeDemand) : Number(availableCouriers);
    let demandMultiplier = 1.0;

    if (supplyDemandRatio < 0.5) {
      demandMultiplier = 2.5; // Very high demand
    } else if (supplyDemandRatio < 1.0) {
      demandMultiplier = 1.8; // High demand
    } else if (supplyDemandRatio < 2.0) {
      demandMultiplier = 1.2; // Normal-high demand
    } else if (supplyDemandRatio > 5.0) {
      demandMultiplier = 0.8; // Low demand, discount pricing
    }

    // Calculate average delivery time (placeholder - would need historical data)
    const averageDeliveryTime = 45.0; // minutes

    return {
      availableCouriers: Number(availableCouriers),
      activeDemand: Number(activeDemand),
      completedDeliveries: Number(completedDeliveries),
      averageDeliveryTime,
      demandMultiplier,
      weatherConditions: null, // Would integrate with weather API
      eventModifier: 1.0, // Would integrate with events API
    };
  }

  /**
   * Get current demand metrics for a location
   */
  private async getCurrentDemandMetrics(locationHash: string): Promise<DemandMetrics | null> {
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);

    return await DemandMetrics.findOne({
      where: {
        locationHash,
        timeSlot: currentHour,
      },
    });
  }

  /**
   * Generate location hash for demand tracking
   */
  private generateLocationHash(coordinates: [number, number]): string {
    const [lng, lat] = coordinates;
    // Round to ~1km precision for demand aggregation
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLng = Math.round(lng * 100) / 100;
    return `${roundedLat}_${roundedLng}`;
  }

  /**
   * Get real-time demand information for multiple locations
   */
  async getLocationDemands(
    locations: [number, number][],
  ): Promise<LocationDemand[]> {
    const demands: LocationDemand[] = [];

    for (const coordinates of locations) {
      const locationHash = this.generateLocationHash(coordinates);
      const metrics = await this.getCurrentDemandMetrics(locationHash);

      if (metrics) {
        demands.push({
          locationHash,
          availableCouriers: metrics.availableCouriers,
          activeDemand: metrics.activeDemand,
          demandMultiplier: metrics.demandMultiplier,
          lastUpdated: metrics.calculatedAt,
        });
      }
    }

    return demands;
  }

  /**
   * Initialize default delivery tiers
   */
  async initializeDefaultTiers(): Promise<void> {
    try {
      const defaultTiers = [
        {
          tierType: DeliveryTierType.LIGHTNING,
          tierName: 'Lightning',
          description: '1-2 hour guaranteed delivery for urgent packages',
          minDeliveryHours: 1,
          maxDeliveryHours: 2,
          basePriceMultiplier: 3.0,
          platformFeePercentage: 40.0,
          slaGuarantee: 95.0,
          isActive: true,
        },
        {
          tierType: DeliveryTierType.EXPRESS,
          tierName: 'Express',
          description: '2-4 hour delivery for important packages',
          minDeliveryHours: 2,
          maxDeliveryHours: 4,
          basePriceMultiplier: 2.0,
          platformFeePercentage: 32.5,
          slaGuarantee: 95.0,
          isActive: true,
        },
        {
          tierType: DeliveryTierType.STANDARD,
          tierName: 'Standard',
          description: '4-8 hour same-day delivery',
          minDeliveryHours: 4,
          maxDeliveryHours: 8,
          basePriceMultiplier: 1.3,
          platformFeePercentage: 27.5,
          slaGuarantee: 90.0,
          isActive: true,
        },
        {
          tierType: DeliveryTierType.ECONOMY,
          tierName: 'Economy',
          description: '8-12 hour budget-friendly delivery',
          minDeliveryHours: 8,
          maxDeliveryHours: 12,
          basePriceMultiplier: 1.0,
          platformFeePercentage: 22.5,
          slaGuarantee: 85.0,
          isActive: true,
        },
      ];

      for (const tierData of defaultTiers) {
        await DeliveryTier.findOrCreate({
          where: { tierType: tierData.tierType },
          defaults: tierData,
        });
      }

      console.log('[DemandPricingEngine] Default delivery tiers initialized');
    } catch (error) {
      console.error('[DemandPricingEngine] Error initializing default tiers:', error);
      throw error;
    }
  }
}

export default DemandPricingEngine;
