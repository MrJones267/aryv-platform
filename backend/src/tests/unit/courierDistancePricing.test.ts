/**
 * @fileoverview Courier prices by distance: parcels taper, documents are flat.
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * Parcels were a per-tier base plus a flat P1.25/km, multiplied by the tier,
 * so 430 km came to P1,800+ and Lightning (1-2 hours) was offered between
 * towns. Documents were priced as parcels. Now: one base fare, a tapering
 * distance charge (P2/km to 10 km, P1/km to 50 km, P0.20/km beyond), only
 * the tiers that can be met, and documents at P30 in town or P80 beyond,
 * door to door, with a 22.5% fee.
 */

import DemandPricingEngine from '../../services/DemandPricingEngine';
import { DeliveryTier, DeliveryTierType } from '../../models/DeliveryTier';
import { DemandMetrics } from '../../models/DemandMetrics';
import { PackageSize } from '../../models/Package';
import { straightLineKm, ROAD_FACTOR, roadDistanceKm } from '../../services/courierDistance';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const GABORONE: [number, number] = [25.9087, -24.6545];
const FRANCISTOWN: [number, number] = [27.5059, -21.1661];

const tier = (tierType: DeliveryTierType, basePriceMultiplier: number, platformFeePercentage: number) =>
  ({
    tierType,
    basePriceMultiplier: String(basePriceMultiplier),
    platformFeePercentage: String(platformFeePercentage),
    minDeliveryHours: 1,
    maxDeliveryHours: 12,
    calculatePlatformFee: (price: number) => Math.round(price * platformFeePercentage) / 100,
    getDeliveryWindow: () => 'window',
  }) as unknown as DeliveryTier;

describe('distance charge', () => {
  it('tapers: P2/km to 10 km, P1/km to 50 km, P0.20/km beyond', () => {
    expect(DemandPricingEngine.distanceCharge(0)).toBe(0);
    expect(DemandPricingEngine.distanceCharge(5)).toBe(10);
    expect(DemandPricingEngine.distanceCharge(10)).toBe(20);
    expect(DemandPricingEngine.distanceCharge(30)).toBe(40);
    expect(DemandPricingEngine.distanceCharge(50)).toBe(60);
    expect(DemandPricingEngine.distanceCharge(430)).toBeCloseTo(136, 5);
  });
});

describe('pricing suggestions', () => {
  const engine = DemandPricingEngine.getInstance();
  const quote = (km: number, packageType: 'parcel' | 'document' = 'parcel') =>
    engine.calculatePricingSuggestions(GABORONE, FRANCISTOWN, PackageSize.SMALL, km, false, false, undefined, 'BWP', packageType);
  const byTier = (suggestions: Awaited<ReturnType<typeof quote>>) =>
    Object.fromEntries(suggestions.map((s) => [s.tierType, s.finalPrice]));

  beforeEach(() => {
    jest.spyOn(DeliveryTier, 'findAll').mockResolvedValue([
      tier(DeliveryTierType.LIGHTNING, 3, 40),
      tier(DeliveryTierType.EXPRESS, 2, 32.5),
      tier(DeliveryTierType.STANDARD, 1.3, 27.5),
      tier(DeliveryTierType.ECONOMY, 1, 22.5),
    ] as any);
    jest.spyOn(DemandMetrics, 'findOne').mockResolvedValue(null);
  });

  afterEach(() => jest.restoreAllMocks());

  it('prices a 430 km parcel in the low hundreds, not the thousands', async () => {
    const prices = byTier(await quote(430));
    // (25 + 136) x tier multiplier
    expect(prices[DeliveryTierType.ECONOMY]).toBeCloseTo(161, 1);
    expect(prices[DeliveryTierType.STANDARD]).toBeCloseTo(209.3, 1);
  });

  it('offers only the tiers that can be met over the distance', async () => {
    expect(Object.keys(byTier(await quote(12))).sort()).toEqual(['economy', 'express', 'lightning', 'standard']);
    expect(Object.keys(byTier(await quote(60))).sort()).toEqual(['economy', 'express', 'standard']);
    expect(Object.keys(byTier(await quote(430))).sort()).toEqual(['economy', 'standard']);
  });

  it('applies the tier once: in town, Lightning is three times Economy', async () => {
    const prices = byTier(await quote(10));
    expect(prices[DeliveryTierType.LIGHTNING]).toBeCloseTo(prices[DeliveryTierType.ECONOMY]! * 3, 5);
  });

  it('prices a document at P30 in town, as Standard, with a 22.5% fee', async () => {
    const [only, ...rest] = await quote(12, 'document');
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ tierType: 'standard', finalPrice: 30, platformFee: 6.75, courierEarnings: 23.25 });
  });

  it('prices a document between towns at P80, overnight (Economy), door to door', async () => {
    const [only, ...rest] = await quote(430, 'document');
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ tierType: 'economy', finalPrice: 80, platformFee: 18, courierEarnings: 62 });
  });
});

describe('road distance', () => {
  const ORIGINAL_KEY = process.env['GOOGLE_MAPS_API_KEY'];
  afterEach(() => { process.env['GOOGLE_MAPS_API_KEY'] = ORIGINAL_KEY; });

  it('estimates from the straight line when Google is not available', async () => {
    delete process.env['GOOGLE_MAPS_API_KEY'];
    const straight = straightLineKm(GABORONE, FRANCISTOWN);
    const route = await roadDistanceKm(GABORONE, FRANCISTOWN);

    expect(straight).toBeGreaterThan(400);
    expect(straight).toBeLessThan(440);
    expect(route.source).toBe('estimated');
    expect(route.km).toBeCloseTo(straight * ROAD_FACTOR, 0);
  });
});
