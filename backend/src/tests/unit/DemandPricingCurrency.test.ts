/**
 * @fileoverview Courier quotes in the sender's currency.
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * The pricing engine's rates are in pula, and its quotes used to be returned
 * unconverted under whatever currency the sender used, so 45 meant 45 pula,
 * 45 rand or 45 kwacha. Quotes are now worked out in pula and converted.
 */

import DemandPricingEngine, { PRICING_BASE_CURRENCY } from '../../services/DemandPricingEngine';
import { DeliveryTier, DeliveryTierType } from '../../models/DeliveryTier';
import { DemandMetrics } from '../../models/DemandMetrics';
import { PackageSize } from '../../models/Package';
import { CurrencyService } from '../../services/CurrencyService';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const PICKUP: [number, number] = [25.92, -24.65];
const DROPOFF: [number, number] = [25.86, -24.62];

const tier = (tierType: DeliveryTierType, basePriceMultiplier: number, platformFeePercentage: number) =>
  ({
    tierType,
    basePriceMultiplier: String(basePriceMultiplier),
    platformFeePercentage: String(platformFeePercentage),
    minDeliveryHours: 2,
    maxDeliveryHours: 4,
    calculatePlatformFee: (price: number) => Math.round(price * platformFeePercentage) / 100,
    getDeliveryWindow: () => '2-4 hours',
  }) as unknown as DeliveryTier;

describe('DemandPricingEngine currency', () => {
  const engine = DemandPricingEngine.getInstance();
  const quote = (currency?: string) =>
    engine.calculatePricingSuggestions(PICKUP, DROPOFF, PackageSize.SMALL, 10, false, false, undefined, currency);

  beforeEach(() => {
    jest.spyOn(DeliveryTier, 'findAll').mockResolvedValue([
      tier(DeliveryTierType.EXPRESS, 2, 32.5),
      tier(DeliveryTierType.STANDARD, 1.3, 27.5),
    ] as any);
    jest.spyOn(DemandMetrics, 'findOne').mockResolvedValue(null);
    jest.spyOn(CurrencyService, 'convertCurrency').mockImplementation(async (_from: string, to: string, amount: number) => {
      if (to === 'ZAR') return { fromCurrency: 'BWP', toCurrency: 'ZAR', amount, convertedAmount: amount * 1.35, exchangeRate: 1.35, timestamp: new Date() };
      throw new Error(`Invalid currency codes: BWP or ${to}`);
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('prices in pula by default, without converting', async () => {
    await quote();
    expect(PRICING_BASE_CURRENCY).toBe('BWP');
    expect(CurrencyService.convertCurrency).not.toHaveBeenCalled();
  });

  it('converts every money figure into the sender\'s currency, at one rate', async () => {
    const pula = await quote('BWP');
    const rand = await quote('ZAR');

    expect(rand).toHaveLength(pula.length);
    rand.forEach((r, i) => {
      const p = pula[i]!;
      for (const field of ['basePrice', 'finalPrice', 'platformFee', 'courierEarnings'] as const) {
        expect(r[field]).toBeCloseTo(p[field] * 1.35, 1);
      }
      // Multipliers and delivery times have no currency.
      expect(r.demandMultiplier).toBe(p.demandMultiplier);
      expect(r.estimatedDeliveryTime).toBe(p.estimatedDeliveryTime);
      expect(r.tierType).toBe(p.tierType);
    });
  });

  it('keeps earnings plus fee equal to the price after converting', async () => {
    for (const s of await quote('ZAR')) {
      expect(s.courierEarnings + s.platformFee).toBeCloseTo(s.finalPrice, 1);
    }
  });

  it('refuses to quote rather than show pula under another currency', async () => {
    await expect(quote('XYZ')).rejects.toThrow();
  });

  it('refuses a rate that is not a positive number', async () => {
    (CurrencyService.convertCurrency as jest.Mock).mockResolvedValue({ exchangeRate: 0 });
    await expect(engine.rateFromBaseCurrency('ZAR')).rejects.toThrow(/No usable exchange rate/);
  });
});
