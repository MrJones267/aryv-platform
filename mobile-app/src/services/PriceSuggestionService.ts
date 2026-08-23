/**
 * @fileoverview What comparable rides charged, for a driver setting a price.
 * @author Oabona-Majoko
 * @created 2026-08-23
 *
 * This replaces AIPricingService, which computed a "final price" for the
 * passenger from a demand score, a congestion score, a weather condition and a
 * toll-road flag — each partly or wholly Math.random(). Two passengers opening
 * the same ride at the same moment could be quoted prices differing by half
 * again, and the server charged neither of them, because it charges the fare
 * the driver set.
 *
 * ARYV is carpooling: the driver names the price. So the useful question is
 * not "what should this passenger pay" but "what do rides like this go for",
 * asked once, by the driver, while they are deciding. The server answers it
 * from completed rides on the same route — the same inputs always give the
 * same answer.
 */

import { apiClient } from './api/baseApi';
import logger from './LoggingService';

const log = logger.createLogger('PriceSuggestionService');

export interface PriceSuggestion {
  /** Null when there is not enough history to say anything honest. */
  suggested: number | null;
  /** The middle half of what comparable rides charged. */
  range: { low: number; high: number } | null;
  /** How many rides this is based on, so a driver can judge it. */
  sampleSize: number;
  perKilometre: number | null;
  currency: string;
  basis: 'comparable_routes' | 'distance_rate' | 'none';
}

class PriceSuggestionService {
  private static instance: PriceSuggestionService;

  static getInstance(): PriceSuggestionService {
    if (!PriceSuggestionService.instance) {
      PriceSuggestionService.instance = new PriceSuggestionService();
    }
    return PriceSuggestionService.instance;
  }

  /**
   * Ask what this route usually costs.
   *
   * Returns null on any failure. A suggestion is a convenience — a driver who
   * is told nothing prices from experience, which is fine; one shown a
   * fabricated figure prices from a fabrication, which is not.
   */
  async forRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    distanceKm?: number,
  ): Promise<PriceSuggestion | null> {
    try {
      const params = new URLSearchParams({
        originLat: String(origin.latitude),
        originLng: String(origin.longitude),
        destinationLat: String(destination.latitude),
        destinationLng: String(destination.longitude),
        ...(distanceKm ? { distanceKm: String(distanceKm) } : {}),
      });

      const response = await apiClient.get(`/rides/price-suggestion?${params.toString()}`);
      const data = response.data?.data as PriceSuggestion | undefined;

      // basis 'none' means the server looked and found too little to report.
      if (!data || data.basis === 'none' || data.suggested === null) {
        return null;
      }

      return data;
    } catch (error) {
      log.warn('Could not load a price suggestion', { error: String(error) });
      return null;
    }
  }
}

export default PriceSuggestionService.getInstance();
