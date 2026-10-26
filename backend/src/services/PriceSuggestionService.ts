/**
 * @fileoverview Suggesting a fare to a driver from what comparable rides charged.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * What this replaces, and why the shape is different:
 *
 * The app carried a client-side pricing model that computed a "final price"
 * from a demand score, a congestion score, a weather condition and a toll-road
 * flag — each of which was partly or wholly `Math.random()`. Two passengers
 * opening the same ride at the same moment could be quoted different prices,
 * varying by up to half again, from a random number generator.
 *
 * That price was also the wrong thing to compute at all. ARYV is carpooling:
 * the driver sets `pricePerSeat` when they create the ride, and the server
 * charges exactly that. So the app was displaying an invented price while the
 * backend billed the driver's — two different numbers for one booking.
 *
 * The honest and useful version of this is advice to the driver, not a
 * surcharge on the passenger. When someone lists a ride, tell them what
 * comparable rides actually charged. That is a real question a driver has, it
 * is answerable from data we hold, and being wrong costs nothing because they
 * remain free to price how they like.
 *
 * Everything below is deterministic: the same route and the same history
 * produce the same suggestion every time.
 */

import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import Ride from '../models/Ride';
import { RideStatus, RideTier } from '../types';
import { round2 } from '../utils/fees';
import { logWarning } from '../utils/logger';
export type { RideTier };
import { surgeService } from './SurgeService';

/**
 * Roughly what each tier charges relative to an ordinary car, used only when
 * falling back to the platform-wide per-kilometre rate, which mixes tiers
 * together. Comparable-route lookups filter by tier instead and need none of
 * this.
 */
const TIER_MULTIPLIERS: Record<RideTier, number> = {
  shared: 0.7,
  standard: 1.0,
  comfort: 1.3,
  premium: 1.8,
};

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PriceSuggestion {
  /** Null when there is not enough history to say anything honest. */
  suggested: number | null;
  /** The middle half of what comparable rides charged. */
  range: { low: number; high: number } | null;
  /** How many rides the answer is based on. Shown so a driver can judge it. */
  sampleSize: number;
  /** Median price per kilometre across the sample, for a distance fallback. */
  perKilometre: number | null;
  currency: string;
  /**
   * Which method produced the number:
   *  'comparable_routes' — rides between roughly these two places
   *  'distance_rate'     — no close routes; the platform's per-km median
   *  'none'              — not enough data to suggest anything
   */
  basis: 'comparable_routes' | 'distance_rate' | 'none';

  /**
   * A dated demand period in force at departure, if any. Advisory: it raises
   * the suggested figure and is shown as a labelled reason. It never alters
   * what a passenger is charged, because the driver's fare is charged as set.
   */
  surge: { multiplier: number; reason: string } | null;

  /** The tier the suggestion was drawn for. */
  tier: RideTier;
}

/**
 * How close the endpoints of a past ride must be to count as the same route.
 * Fifteen kilometres is generous enough that "Gaborone to Francistown" matches
 * regardless of which suburb each ride started in, and tight enough that it
 * does not pull in a different journey.
 */
const ROUTE_MATCH_RADIUS_METRES = 15000;

/**
 * Below this, a median is not worth reporting: three rides can easily all be
 * the same optimistic driver, and a confident suggestion drawn from them would
 * be worse than admitting we do not know.
 */
const MIN_SAMPLE_FOR_ROUTE = 4;

/** The platform-wide per-km rate needs more support to be meaningful. */
const MIN_SAMPLE_FOR_RATE = 20;

/** Only recent rides, so a suggestion tracks what people charge now. */
const HISTORY_DAYS = 180;

/** Percentile of a sorted list, by linear interpolation. */
const percentile = (sorted: number[], fraction: number): number => {
  if (sorted.length === 0) {
    return 0;
  }

  if (sorted.length === 1) {
    return sorted[0]!;
  }

  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) {
    return sorted[lower]!;
  }

  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
};

export class PriceSuggestionService {
  /**
   * What to charge for a seat on this route.
   *
   * Tries rides between roughly the same two places first, because that is the
   * closest comparison available. Falls back to the platform's median rate per
   * kilometre, which is weaker but still grounded in real prices. Returns null
   * rather than inventing a number when neither has enough support.
   */
  async suggestForRoute(
    origin: Coordinates,
    destination: Coordinates,
    options: {
      distanceKm?: number;
      currency?: string;
      tier?: RideTier;
      departureTime?: Date;
    } = {},
  ): Promise<PriceSuggestion> {
    const currency = options.currency ?? 'BWP';
    const tier = options.tier ?? 'standard';

    // A dated period around a public holiday, if the ride departs in one.
    const surge = await surgeService.getSurge(options.departureTime ?? new Date(), origin);
    const applySurge = (value: number) => round2(value * surge.multiplier);
    const surgeSummary = surge.reason
      ? { multiplier: surge.multiplier, reason: surge.reason }
      : null;

    try {
      const comparable = await this.findComparableFares(origin, destination, tier);

      if (comparable.length >= MIN_SAMPLE_FOR_ROUTE) {
        const sorted = [...comparable].sort((a, b) => a - b);

        return {
          // The median, not the mean: one driver charging ten times the going
          // rate should not drag the suggestion up.
          suggested: applySurge(percentile(sorted, 0.5)),
          range: {
            low: applySurge(percentile(sorted, 0.25)),
            high: applySurge(percentile(sorted, 0.75)),
          },
          sampleSize: sorted.length,
          perKilometre: options.distanceKm
            ? round2(percentile(sorted, 0.5) / options.distanceKm)
            : null,
          currency,
          basis: 'comparable_routes',
          surge: surgeSummary,
          tier,
        };
      }

      // No close routes. A per-kilometre rate across the platform is a weaker
      // comparison but still a real one, provided we know how far this is.
      if (options.distanceKm && options.distanceKm > 0) {
        const rate = await this.medianRatePerKilometre();

        if (rate) {
          // The platform rate is drawn from every tier, so it is scaled to
          // the one being asked about before surge is applied.
          const tiered = rate.median * TIER_MULTIPLIERS[tier];

          return {
            suggested: applySurge(tiered * options.distanceKm),
            range: {
              low: applySurge(rate.low * TIER_MULTIPLIERS[tier] * options.distanceKm),
              high: applySurge(rate.high * TIER_MULTIPLIERS[tier] * options.distanceKm),
            },
            sampleSize: rate.sampleSize,
            perKilometre: round2(tiered),
            currency,
            basis: 'distance_rate',
            surge: surgeSummary,
            tier,
          };
        }
      }

      return {
        suggested: null,
        range: null,
        sampleSize: comparable.length,
        perKilometre: null,
        currency,
        basis: 'none',
        surge: surgeSummary,
        tier,
      };
    } catch (error) {
      // A suggestion is a convenience. Failing to produce one must never stop
      // a driver listing a ride, so this degrades to "no opinion".
      logWarning('Could not compute a price suggestion', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        suggested: null,
        range: null,
        sampleSize: 0,
        perKilometre: null,
        currency,
        basis: 'none',
        surge: null,
        tier,
      };
    }
  }

  /**
   * Seat prices from past rides that ran between roughly these two places.
   *
   * Only completed rides count. A pending or cancelled one proves nothing
   * about what people will actually pay — anyone can list a ride at any price,
   * and the ones nobody booked are exactly the prices not to copy.
   */
  private async findComparableFares(
    origin: Coordinates,
    destination: Coordinates,
    tier: RideTier,
  ): Promise<number[]> {
    const since = new Date();
    since.setDate(since.getDate() - HISTORY_DAYS);

    const rides = await Ride.findAll({
      attributes: ['pricePerSeat'],
      where: {
        status: RideStatus.COMPLETED,
        createdAt: { [Op.gte]: since },
        // Like for like: a premium sedan should not be advised to charge what
        // a shared minibus does on the same road.
        tier,
        [Op.and]: [
          sequelize.where(
            sequelize.fn(
              'ST_DWithin',
              sequelize.col('originCoordinates'),
              sequelize.fn(
                'ST_SetSRID',
                sequelize.fn('ST_MakePoint', origin.longitude, origin.latitude),
                4326,
              ),
              ROUTE_MATCH_RADIUS_METRES,
            ),
            true,
          ),
          sequelize.where(
            sequelize.fn(
              'ST_DWithin',
              sequelize.col('destinationCoordinates'),
              sequelize.fn(
                'ST_SetSRID',
                sequelize.fn('ST_MakePoint', destination.longitude, destination.latitude),
                4326,
              ),
              ROUTE_MATCH_RADIUS_METRES,
            ),
            true,
          ),
        ],
      },
      limit: 500,
      raw: true,
    }) as unknown as Array<{ pricePerSeat: string | number }>;

    return rides
      .map((ride) => Number(ride.pricePerSeat))
      .filter((price) => Number.isFinite(price) && price > 0);
  }

  /**
   * The platform's median price per kilometre, from completed rides that
   * recorded a distance.
   */
  private async medianRatePerKilometre(): Promise<
    { median: number; low: number; high: number; sampleSize: number } | null
  > {
    const since = new Date();
    since.setDate(since.getDate() - HISTORY_DAYS);

    const rides = await Ride.findAll({
      attributes: ['pricePerSeat', 'distance'],
      where: {
        status: RideStatus.COMPLETED,
        createdAt: { [Op.gte]: since },
        distance: { [Op.gt]: 0 },
      },
      limit: 2000,
      raw: true,
    }) as unknown as Array<{ pricePerSeat: string | number; distance: string | number }>;

    const rates = rides
      .map((ride) => Number(ride.pricePerSeat) / Number(ride.distance))
      .filter((rate) => Number.isFinite(rate) && rate > 0)
      .sort((a, b) => a - b);

    if (rates.length < MIN_SAMPLE_FOR_RATE) {
      return null;
    }

    return {
      median: percentile(rates, 0.5),
      low: percentile(rates, 0.25),
      high: percentile(rates, 0.75),
      sampleSize: rates.length,
    };
  }
}

export const priceSuggestionService = new PriceSuggestionService();
export default priceSuggestionService;
