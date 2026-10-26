/**
 * @fileoverview Rides on the routes this passenger actually travels.
 * @author Oabona-Majoko
 * @created 2026-08-23
 *
 * This replaces AIRecommendationsService, which fabricated its own input: it
 * generated ten to thirty invented past rides for the user, scattered around
 * latitude 37.77, longitude -122.41 — San Francisco — and derived
 * recommendations from them, including an "expected savings" figure that was a
 * random number shown as money.
 *
 * The server now answers this from the user's real completed bookings: the
 * routes they repeat, and the upcoming rides on those routes. A new user gets
 * an empty list, which is the true answer.
 */

import { apiClient } from './api/baseApi';
import logger from './LoggingService';

const log = logger.createLogger('RideRecommendationService');

export interface FrequentRoute {
  originAddress: string;
  destinationAddress: string;
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  /** How many times they have made this journey. */
  tripCount: number;
  lastTravelled: string;
}

export interface RideRecommendation {
  route: FrequentRoute;
  /** Upcoming rides on that route. Empty means none are listed yet. */
  upcoming: Array<{
    id: string;
    departureTime: string;
    pricePerSeat: number;
    availableSeats: number;
    originAddress: string;
    destinationAddress: string;
  }>;
}

class RideRecommendationService {
  private static instance: RideRecommendationService;

  static getInstance(): RideRecommendationService {
    if (!RideRecommendationService.instance) {
      RideRecommendationService.instance = new RideRecommendationService();
    }
    return RideRecommendationService.instance;
  }

  /**
   * Returns an empty list on failure rather than throwing. Recommendations are
   * a convenience, and an empty screen with an explanation beats an error
   * dialog over something the user did not ask for.
   */
  async getRecommendations(): Promise<RideRecommendation[]> {
    try {
      const response = await apiClient.get('/rides/recommendations');
      return (response.data?.data as RideRecommendation[]) ?? [];
    } catch (error) {
      log.warn('Could not load recommendations', { error: String(error) });
      return [];
    }
  }
}

export default RideRecommendationService.getInstance();
