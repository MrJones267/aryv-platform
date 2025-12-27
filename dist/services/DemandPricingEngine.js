"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemandPricingEngine = void 0;
const DemandMetrics_1 = require("../models/DemandMetrics");
const DeliveryTier_1 = require("../models/DeliveryTier");
const Package_1 = require("../models/Package");
const CourierProfile_1 = require("../models/CourierProfile");
const database_1 = require("../config/database");
const sequelize_1 = require("sequelize");
class DemandPricingEngine {
    constructor() {
        this.BASE_PRICES = {
            [DeliveryTier_1.DeliveryTierType.LIGHTNING]: 50.0,
            [DeliveryTier_1.DeliveryTierType.EXPRESS]: 35.0,
            [DeliveryTier_1.DeliveryTierType.STANDARD]: 25.0,
            [DeliveryTier_1.DeliveryTierType.ECONOMY]: 18.0,
        };
        this.PACKAGE_SIZE_MULTIPLIERS = {
            [Package_1.PackageSize.SMALL]: 1.0,
            [Package_1.PackageSize.MEDIUM]: 1.2,
            [Package_1.PackageSize.LARGE]: 1.5,
            [Package_1.PackageSize.CUSTOM]: 2.0,
        };
        this.DISTANCE_RATE_PER_KM = 1.25;
        this.FRAGILE_SURCHARGE = 5.0;
        this.VALUABLE_SURCHARGE = 10.0;
    }
    static getInstance() {
        if (!DemandPricingEngine.instance) {
            DemandPricingEngine.instance = new DemandPricingEngine();
        }
        return DemandPricingEngine.instance;
    }
    async calculatePricingSuggestions(pickupCoordinates, _dropoffCoordinates, packageSize, distance, isFragile = false, isValuable = false, requestedDeliveryTime) {
        try {
            const locationHash = this.generateLocationHash(pickupCoordinates);
            const demandMetrics = await this.getCurrentDemandMetrics(locationHash);
            const deliveryTiers = await DeliveryTier_1.DeliveryTier.findAll({
                where: { isActive: true },
                order: [['minDeliveryHours', 'ASC']],
            });
            const suggestions = [];
            for (const tier of deliveryTiers) {
                const suggestion = await this.calculateTierPricing(tier, distance, packageSize, isFragile, isValuable, demandMetrics, requestedDeliveryTime);
                suggestions.push(suggestion);
            }
            return suggestions;
        }
        catch (error) {
            console.error('[DemandPricingEngine] Error calculating pricing suggestions:', error);
            throw new Error('Failed to calculate pricing suggestions');
        }
    }
    async calculateTierPricing(tier, distance, packageSize, isFragile, isValuable, demandMetrics, requestedDeliveryTime) {
        let basePrice = this.BASE_PRICES[tier.tierType] || 25.0;
        basePrice += distance * this.DISTANCE_RATE_PER_KM;
        basePrice *= this.PACKAGE_SIZE_MULTIPLIERS[packageSize] || 1.0;
        if (isFragile)
            basePrice += this.FRAGILE_SURCHARGE;
        if (isValuable)
            basePrice += this.VALUABLE_SURCHARGE;
        basePrice *= tier.basePriceMultiplier;
        const demandMultiplier = demandMetrics?.demandMultiplier || 1.0;
        const urgencyMultiplier = this.calculateUrgencyMultiplier(tier, requestedDeliveryTime);
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
    calculateUrgencyMultiplier(tier, requestedDeliveryTime) {
        if (!requestedDeliveryTime)
            return 1.0;
        const now = new Date();
        const hoursUntilRequested = (requestedDeliveryTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilRequested < tier.minDeliveryHours) {
            if (hoursUntilRequested <= 0.5)
                return 2.0;
            if (hoursUntilRequested <= 1.0)
                return 1.5;
            return 1.25;
        }
        return 1.0;
    }
    async updateDemandMetrics(coordinates, forceUpdate = false) {
        try {
            const locationHash = this.generateLocationHash(coordinates);
            const currentHour = new Date();
            currentHour.setMinutes(0, 0, 0);
            const existingMetrics = await DemandMetrics_1.DemandMetrics.findOne({
                where: {
                    locationHash,
                    timeSlot: currentHour,
                },
            });
            if (existingMetrics && !forceUpdate && existingMetrics.isDataFresh(15)) {
                return existingMetrics;
            }
            const metrics = await this.calculateCurrentMetrics(locationHash, coordinates);
            if (existingMetrics) {
                await existingMetrics.update({
                    ...metrics,
                    calculatedAt: new Date(),
                });
                return existingMetrics;
            }
            else {
                return await DemandMetrics_1.DemandMetrics.create({
                    locationHash,
                    timeSlot: currentHour,
                    calculatedAt: new Date(),
                    ...metrics,
                });
            }
        }
        catch (error) {
            console.error('[DemandPricingEngine] Error updating demand metrics:', error);
            throw new Error('Failed to update demand metrics');
        }
    }
    async calculateCurrentMetrics(_locationHash, coordinates) {
        const [lng, lat] = coordinates;
        const radiusKm = 20;
        const availableCouriers = await CourierProfile_1.CourierProfile.count({
            where: {
                isCourierActive: true,
                isAvailable: true,
            },
            include: [{
                    model: database_1.sequelize.models['User'],
                    where: database_1.sequelize.literal(`
          ST_DWithin(
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            last_known_location::geography,
            ${radiusKm * 1000}
          )
        `),
                }],
        });
        const activeDemand = await Package_1.Package.count({
            where: {
                isActive: true,
                [sequelize_1.Op.or]: [
                    { expiresAt: { [sequelize_1.Op.is]: undefined } },
                    { expiresAt: { [sequelize_1.Op.gt]: new Date() } },
                ],
                [sequelize_1.Op.and]: [
                    database_1.sequelize.literal(`
            ST_DWithin(
              pickup_coordinates::geography,
              ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
              ${radiusKm * 1000}
            )
          `),
                ],
            },
        });
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const completedDeliveries = await database_1.sequelize.models['DeliveryAgreement'].count({
            where: {
                status: 'completed',
                deliveryConfirmedAt: { [sequelize_1.Op.gte]: oneHourAgo },
            },
            include: [{
                    model: Package_1.Package,
                    where: database_1.sequelize.literal(`
          ST_DWithin(
            pickup_coordinates::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radiusKm * 1000}
          )
        `),
                }],
        });
        const supplyDemandRatio = activeDemand > 0 ? Number(availableCouriers) / Number(activeDemand) : Number(availableCouriers);
        let demandMultiplier = 1.0;
        if (supplyDemandRatio < 0.5) {
            demandMultiplier = 2.5;
        }
        else if (supplyDemandRatio < 1.0) {
            demandMultiplier = 1.8;
        }
        else if (supplyDemandRatio < 2.0) {
            demandMultiplier = 1.2;
        }
        else if (supplyDemandRatio > 5.0) {
            demandMultiplier = 0.8;
        }
        const averageDeliveryTime = 45.0;
        return {
            availableCouriers: Number(availableCouriers),
            activeDemand: Number(activeDemand),
            completedDeliveries: Number(completedDeliveries),
            averageDeliveryTime,
            demandMultiplier,
            weatherConditions: null,
            eventModifier: 1.0,
        };
    }
    async getCurrentDemandMetrics(locationHash) {
        const currentHour = new Date();
        currentHour.setMinutes(0, 0, 0);
        return await DemandMetrics_1.DemandMetrics.findOne({
            where: {
                locationHash,
                timeSlot: currentHour,
            },
        });
    }
    generateLocationHash(coordinates) {
        const [lng, lat] = coordinates;
        const roundedLat = Math.round(lat * 100) / 100;
        const roundedLng = Math.round(lng * 100) / 100;
        return `${roundedLat}_${roundedLng}`;
    }
    async getLocationDemands(locations) {
        const demands = [];
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
    async initializeDefaultTiers() {
        try {
            const defaultTiers = [
                {
                    tierType: DeliveryTier_1.DeliveryTierType.LIGHTNING,
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
                    tierType: DeliveryTier_1.DeliveryTierType.EXPRESS,
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
                    tierType: DeliveryTier_1.DeliveryTierType.STANDARD,
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
                    tierType: DeliveryTier_1.DeliveryTierType.ECONOMY,
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
                await DeliveryTier_1.DeliveryTier.findOrCreate({
                    where: { tierType: tierData.tierType },
                    defaults: tierData,
                });
            }
            console.log('[DemandPricingEngine] Default delivery tiers initialized');
        }
        catch (error) {
            console.error('[DemandPricingEngine] Error initializing default tiers:', error);
            throw error;
        }
    }
}
exports.DemandPricingEngine = DemandPricingEngine;
exports.default = DemandPricingEngine;
//# sourceMappingURL=DemandPricingEngine.js.map