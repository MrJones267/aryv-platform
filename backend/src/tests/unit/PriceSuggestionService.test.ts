/**
 * @fileoverview Suggesting a fare from what comparable rides charged.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * This replaces a client-side pricing model whose demand score, congestion
 * score and toll-road flag were partly or wholly Math.random(), and whose
 * output was shown to passengers as a price while the server charged the
 * driver's actual fare.
 *
 * Two properties matter here. It must be deterministic — the same route and
 * the same history give the same number, every time. And it must return
 * nothing rather than a guess when the history is too thin, because a
 * confident figure drawn from three rides is worse than no figure at all.
 */

import { PriceSuggestionService } from '../../services/PriceSuggestionService';
import Ride from '../../models/Ride';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

const FRANCISTOWN = { latitude: -21.17, longitude: 27.51 };
const GABORONE = { latitude: -24.65, longitude: 25.92 };

/** Comparable-route lookup reads pricePerSeat; the rate lookup adds distance. */
const fares = (prices: number[]) => prices.map((pricePerSeat) => ({ pricePerSeat }));
const rated = (count: number, price: number, distance: number) =>
  Array.from({ length: count }, () => ({ pricePerSeat: price, distance }));

describe('PriceSuggestionService', () => {
  let service: PriceSuggestionService;

  beforeEach(() => {
    service = new PriceSuggestionService();
  });

  /** First call is the route lookup, second the platform-wide rate. */
  const withHistory = (route: unknown[], rates: unknown[] = []) => {
    jest.spyOn(Ride, 'findAll')
      .mockResolvedValueOnce(route as any)
      .mockResolvedValueOnce(rates as any);
  };

  describe('when comparable routes exist', () => {
    it('suggests the median of what they charged', async () => {
      withHistory(fares([120, 140, 150, 160, 200]));

      const result = await service.suggestForRoute(FRANCISTOWN, GABORONE);

      expect(result.suggested).toBe(150);
      expect(result.basis).toBe('comparable_routes');
    });

    it('uses the median, so one outlier cannot drag the suggestion up', async () => {
      // The mean of these is 330. A driver told to charge 330 on a route
      // where everyone charges 150 would never fill the car.
      withHistory(fares([140, 150, 150, 160, 1050]));

      const result = await service.suggestForRoute(FRANCISTOWN, GABORONE);

      expect(result.suggested).toBe(150);
    });

    it('reports the middle half as a range', async () => {
      withHistory(fares([100, 120, 140, 160, 180]));

      const result = await service.suggestForRoute(FRANCISTOWN, GABORONE);

      expect(result.range).toEqual({ low: 120, high: 160 });
    });

    it('says how many rides it looked at', async () => {
      // Shown to the driver so they can weigh the advice.
      withHistory(fares([120, 140, 150, 160]));

      const result = await service.suggestForRoute(FRANCISTOWN, GABORONE);

      expect(result.sampleSize).toBe(4);
    });

    it('gives the same answer twice for the same history', async () => {
      // The property the old model could not have: it was seeded by
      // Math.random() on every call.
      jest.spyOn(Ride, 'findAll').mockResolvedValue(fares([120, 140, 150, 160]) as any);

      const first = await service.suggestForRoute(FRANCISTOWN, GABORONE);
      const second = await service.suggestForRoute(FRANCISTOWN, GABORONE);

      expect(first.suggested).toBe(second.suggested);
      expect(first.range).toEqual(second.range);
    });

    it('ignores prices that are zero or unreadable', async () => {
      withHistory([
        { pricePerSeat: 140 }, { pricePerSeat: 150 }, { pricePerSeat: 160 },
        { pricePerSeat: 170 },
        { pricePerSeat: 0 }, { pricePerSeat: null }, { pricePerSeat: 'free' },
      ]);

      const result = await service.suggestForRoute(FRANCISTOWN, GABORONE);

      expect(result.sampleSize).toBe(4);
      expect(result.suggested).toBe(155);
    });
  });

  describe('when the route has too little history', () => {
    it('says nothing rather than guessing from three rides', async () => {
      withHistory(fares([140, 150, 160]));

      const result = await service.suggestForRoute(FRANCISTOWN, GABORONE);

      expect(result.suggested).toBeNull();
      expect(result.basis).toBe('none');
    });

    it('falls back to the platform rate per kilometre when a distance is known', async () => {
      // 20 rides at P100 over 50km is P2/km; a 400km trip suggests P800.
      withHistory(fares([140]), rated(20, 100, 50));

      const result = await service.suggestForRoute(FRANCISTOWN, GABORONE, { distanceKm: 400 });

      expect(result.basis).toBe('distance_rate');
      expect(result.suggested).toBe(800);
      expect(result.perKilometre).toBe(2);
    });

    it('will not use the platform rate without a distance to apply it to', async () => {
      withHistory(fares([140]), rated(20, 100, 50));

      const result = await service.suggestForRoute(FRANCISTOWN, GABORONE);

      expect(result.basis).toBe('none');
      expect(result.suggested).toBeNull();
    });

    it('says nothing when even the platform-wide sample is thin', async () => {
      withHistory(fares([140]), rated(5, 100, 50));

      const result = await service.suggestForRoute(FRANCISTOWN, GABORONE, { distanceKm: 400 });

      expect(result.basis).toBe('none');
      expect(result.suggested).toBeNull();
    });
  });

  describe('when there is no history at all', () => {
    it('returns no opinion', async () => {
      withHistory([], []);

      const result = await service.suggestForRoute(FRANCISTOWN, GABORONE, { distanceKm: 400 });

      expect(result.suggested).toBeNull();
      expect(result.range).toBeNull();
      expect(result.basis).toBe('none');
    });
  });

  describe('when the query fails', () => {
    it('returns no opinion instead of throwing', async () => {
      // A driver must still be able to list a ride when this is broken.
      jest.spyOn(Ride, 'findAll').mockRejectedValue(new Error('database down'));

      const result = await service.suggestForRoute(FRANCISTOWN, GABORONE);

      expect(result.suggested).toBeNull();
      expect(result.basis).toBe('none');
    });
  });

  describe('currency', () => {
    it('reports the currency it was asked for', async () => {
      withHistory(fares([120, 140, 150, 160]));

      const result = await service.suggestForRoute(FRANCISTOWN, GABORONE, { currency: 'ZAR' });

      expect(result.currency).toBe('ZAR');
    });

    it('defaults to the platform currency', async () => {
      withHistory(fares([120, 140, 150, 160]));

      expect((await service.suggestForRoute(FRANCISTOWN, GABORONE)).currency).toBe('BWP');
    });
  });
});
