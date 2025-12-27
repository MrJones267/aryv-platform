/**
 * @fileoverview Tests for demand-based pricing engine
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { sequelize } from '../config/database';
import DemandPricingEngine from '../services/DemandPricingEngine';
import { DeliveryTier, DeliveryTierType } from '../models/DeliveryTier';
import { DemandMetrics } from '../models/DemandMetrics';
import { PackageSize } from '../models/Package';

describe('Demand-Based Pricing Engine', () => {
  let pricingEngine: DemandPricingEngine;

  beforeAll(async () => {
    // Setup test database
    await sequelize.sync({ force: true });
    pricingEngine = DemandPricingEngine.getInstance();
    await pricingEngine.initializeDefaultTiers();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Delivery Tiers', () => {
    it('should create default delivery tiers', async () => {
      const tiers = await DeliveryTier.findAll();
      expect(tiers).toHaveLength(4);
      
      const tierTypes = tiers.map(t => t.tierType);
      expect(tierTypes).toContain(DeliveryTierType.LIGHTNING);
      expect(tierTypes).toContain(DeliveryTierType.EXPRESS);
      expect(tierTypes).toContain(DeliveryTierType.STANDARD);
      expect(tierTypes).toContain(DeliveryTierType.ECONOMY);
    });

    it('should validate tier properties', async () => {
      const lightningTier = await DeliveryTier.findOne({
        where: { tierType: DeliveryTierType.LIGHTNING }
      });

      expect(lightningTier).not.toBeNull();
      expect(lightningTier!.minDeliveryHours).toBe(1);
      expect(lightningTier!.maxDeliveryHours).toBe(2);
      expect(lightningTier!.platformFeePercentage).toBe(40.0);
      expect(lightningTier!.slaGuarantee).toBe(95.0);
    });
  });

  describe('Pricing Calculations', () => {
    it('should calculate pricing suggestions for all tiers', async () => {
      const pickupCoords: [number, number] = [25.0, -24.0]; // Gaborone area
      const dropoffCoords: [number, number] = [25.5, -24.5]; // Nearby location
      
      const suggestions = await pricingEngine.calculatePricingSuggestions(
        pickupCoords,
        dropoffCoords,
        PackageSize.MEDIUM,
        50, // 50km distance
        false,
        false
      );

      expect(suggestions).toHaveLength(4);
      
      // Check that Lightning tier is most expensive
      const lightning = suggestions.find(s => s.tierType === DeliveryTierType.LIGHTNING);
      const economy = suggestions.find(s => s.tierType === DeliveryTierType.ECONOMY);
      
      expect(lightning!.finalPrice).toBeGreaterThan(economy!.finalPrice);
      expect(lightning!.platformFee).toBeGreaterThan(economy!.platformFee);
    });

    it('should apply package size multipliers correctly', async () => {
      const coords: [number, number] = [25.0, -24.0];
      
      const smallSuggestions = await pricingEngine.calculatePricingSuggestions(
        coords, coords, PackageSize.SMALL, 10, false, false
      );
      
      const largeSuggestions = await pricingEngine.calculatePricingSuggestions(
        coords, coords, PackageSize.LARGE, 10, false, false
      );

      const smallStandard = smallSuggestions.find(s => s.tierType === DeliveryTierType.STANDARD);
      const largeStandard = largeSuggestions.find(s => s.tierType === DeliveryTierType.STANDARD);
      
      expect(largeStandard!.finalPrice).toBeGreaterThan(smallStandard!.finalPrice);
    });

    it('should apply fragile and valuable surcharges', async () => {
      const coords: [number, number] = [25.0, -24.0];
      
      const normalSuggestions = await pricingEngine.calculatePricingSuggestions(
        coords, coords, PackageSize.MEDIUM, 10, false, false
      );
      
      const fragileSuggestions = await pricingEngine.calculatePricingSuggestions(
        coords, coords, PackageSize.MEDIUM, 10, true, true
      );

      const normalStandard = normalSuggestions.find(s => s.tierType === DeliveryTierType.STANDARD);
      const fragileStandard = fragileSuggestions.find(s => s.tierType === DeliveryTierType.STANDARD);
      
      expect(fragileStandard!.finalPrice).toBeGreaterThan(normalStandard!.finalPrice);
    });
  });

  describe('Demand Metrics', () => {
    it('should create and update demand metrics', async () => {
      const coords: [number, number] = [25.0, -24.0];
      
      const metrics = await pricingEngine.updateDemandMetrics(coords);
      
      expect(metrics).toBeDefined();
      expect(metrics.locationHash).toBeDefined();
      expect(metrics.demandMultiplier).toBeGreaterThan(0);
      expect(metrics.demandMultiplier).toBeLessThanOrEqual(5.0);
    });

    it('should return consistent location hash for similar coordinates', async () => {
      const coords1: [number, number] = [25.001, -24.001];
      const coords2: [number, number] = [25.002, -24.002];
      
      const metrics1 = await pricingEngine.updateDemandMetrics(coords1);
      const metrics2 = await pricingEngine.updateDemandMetrics(coords2);
      
      expect(metrics1.locationHash).toBe(metrics2.locationHash);
    });

    it('should provide fresh data check', async () => {
      const coords: [number, number] = [25.1, -24.1];
      
      const metrics = await pricingEngine.updateDemandMetrics(coords);
      expect(metrics.isDataFresh(15)).toBe(true);
      expect(metrics.isDataFresh(0)).toBe(false);
    });
  });

  describe('Location Demand Analysis', () => {
    it('should get demand information for multiple locations', async () => {
      const locations: [number, number][] = [
        [25.0, -24.0],
        [25.1, -24.1],
        [25.2, -24.2]
      ];
      
      // First, create some metrics
      for (const location of locations) {
        await pricingEngine.updateDemandMetrics(location);
      }
      
      const demands = await pricingEngine.getLocationDemands(locations);
      
      expect(demands.length).toBeGreaterThan(0);
      expect(demands.length).toBeLessThanOrEqual(locations.length);
      
      demands.forEach(demand => {
        expect(demand.locationHash).toBeDefined();
        expect(demand.demandMultiplier).toBeGreaterThan(0);
        expect(demand.availableCouriers).toBeGreaterThanOrEqual(0);
        expect(demand.activeDemand).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should calculate complete pricing with demand factors', async () => {
      const coords: [number, number] = [25.3, -24.3];
      
      // Update demand metrics first
      await pricingEngine.updateDemandMetrics(coords);
      
      // Get pricing suggestions
      const suggestions = await pricingEngine.calculatePricingSuggestions(
        coords,
        [25.8, -24.8], // Further location
        PackageSize.LARGE,
        100, // 100km
        true, // fragile
        true  // valuable
      );
      
      expect(suggestions).toHaveLength(4);
      
      // All suggestions should have positive prices
      suggestions.forEach(suggestion => {
        expect(suggestion.finalPrice).toBeGreaterThan(0);
        expect(suggestion.courierEarnings).toBeGreaterThan(0);
        expect(suggestion.platformFee).toBeGreaterThan(0);
        expect(suggestion.basePrice).toBeGreaterThan(0);
        expect(suggestion.demandMultiplier).toBeGreaterThanOrEqual(0.5);
        expect(suggestion.demandMultiplier).toBeLessThanOrEqual(5.0);
      });
      
      // Lightning should be most expensive
      const lightning = suggestions.find(s => s.tierType === DeliveryTierType.LIGHTNING);
      const economy = suggestions.find(s => s.tierType === DeliveryTierType.ECONOMY);
      
      expect(lightning!.finalPrice).toBeGreaterThan(economy!.finalPrice);
      expect(lightning!.estimatedDeliveryTime).toContain('1-2');
      expect(economy!.estimatedDeliveryTime).toContain('8-12');
    });

    it('should handle urgency multipliers correctly', async () => {
      const coords: [number, number] = [25.4, -24.4];
      
      // Request delivery 30 minutes from now (very urgent)
      const urgentTime = new Date();
      urgentTime.setMinutes(urgentTime.getMinutes() + 30);
      
      const urgentSuggestions = await pricingEngine.calculatePricingSuggestions(
        coords, coords, PackageSize.MEDIUM, 10, false, false, urgentTime
      );
      
      const normalSuggestions = await pricingEngine.calculatePricingSuggestions(
        coords, coords, PackageSize.MEDIUM, 10, false, false
      );
      
      const urgentLightning = urgentSuggestions.find(s => s.tierType === DeliveryTierType.LIGHTNING);
      const normalLightning = normalSuggestions.find(s => s.tierType === DeliveryTierType.LIGHTNING);
      
      // Urgent delivery should be more expensive
      expect(urgentLightning!.finalPrice).toBeGreaterThan(normalLightning!.finalPrice);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid coordinates gracefully', async () => {
      const invalidCoords: [number, number] = [999, 999];
      
      await expect(
        pricingEngine.calculatePricingSuggestions(
          invalidCoords, invalidCoords, PackageSize.MEDIUM, 10, false, false
        )
      ).resolves.toBeDefined();
    });

    it('should handle zero distance correctly', async () => {
      const coords: [number, number] = [25.0, -24.0];
      
      const suggestions = await pricingEngine.calculatePricingSuggestions(
        coords, coords, PackageSize.MEDIUM, 0, false, false
      );
      
      expect(suggestions).toHaveLength(4);
      suggestions.forEach(suggestion => {
        expect(suggestion.finalPrice).toBeGreaterThan(0);
      });
    });
  });
});

describe('Delivery Tier Model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should create delivery tier with valid data', async () => {
    const tier = await DeliveryTier.create({
      tierType: DeliveryTierType.EXPRESS,
      tierName: 'Test Express',
      description: 'Test description',
      minDeliveryHours: 2,
      maxDeliveryHours: 4,
      basePriceMultiplier: 2.0,
      platformFeePercentage: 30.0,
      slaGuarantee: 95.0,
      isActive: true
    });

    expect(tier.id).toBeDefined();
    expect(tier.getDeliveryWindow()).toBe('2-4 hours');
    expect(tier.calculatePlatformFee(100)).toBe(30);
  });

  it('should validate tier constraints', async () => {
    await expect(
      DeliveryTier.create({
        tierType: DeliveryTierType.LIGHTNING,
        tierName: 'Invalid Tier',
        description: 'Test',
        minDeliveryHours: 10, // Invalid: min > max
        maxDeliveryHours: 5,
        basePriceMultiplier: 1.0,
        platformFeePercentage: 25.0,
        slaGuarantee: 95.0,
        isActive: true
      })
    ).rejects.toThrow();
  });

  it('should check SLA compliance correctly', async () => {
    const tier = await DeliveryTier.findOne({
      where: { tierType: DeliveryTierType.EXPRESS }
    });

    const createdTime = new Date();
    const onTimeDelivery = new Date(createdTime.getTime() + 3 * 60 * 60 * 1000); // 3 hours
    const lateDelivery = new Date(createdTime.getTime() + 6 * 60 * 60 * 1000); // 6 hours

    expect(tier!.isWithinSLA(onTimeDelivery, createdTime)).toBe(true);
    expect(tier!.isWithinSLA(lateDelivery, createdTime)).toBe(false);
  });
});