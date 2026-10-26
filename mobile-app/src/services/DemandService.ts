/**
 * @fileoverview How busy an area is, from real rides and bookings.
 * @author Oabona-Majoko
 * @created 2026-08-23
 *
 * This replaces PredictiveAIService, which proxied to a Python model at
 * AI_SERVICE_URL — localhost:5001 by default, with nothing deployed there — so
 * every call fell through to a fallback returning the constant 10 at a
 * confidence of 0.3. The backend router exposing those endpoints was never
 * mounted, so they did not exist to call in the first place.
 *
 * Demand needs no model here: it is seats wanted against seats offered, which
 * the database can answer directly and identically for everyone who asks.
 */

import { apiClient } from './api/baseApi';
import logger from './LoggingService';

const log = logger.createLogger('DemandService');

export interface DemandSnapshot {
  seatsOffered: number;
  seatsTaken: number;
  /** Taken as a share of offered. Null when nothing is on offer. */
  occupancy: number | null;
  level: 'quiet' | 'steady' | 'busy' | 'very_busy' | 'unknown';
  ridesConsidered: number;
  /** Seats booked by hour of day, 0–23, from recent history. */
  hourlyBookings: number[];
  radiusKm: number;
  generatedAt: string;
}

class DemandService {
  private static instance: DemandService;

  static getInstance(): DemandService {
    if (!DemandService.instance) {
      DemandService.instance = new DemandService();
    }
    return DemandService.instance;
  }

  async forLocation(
    latitude: number,
    longitude: number,
    radiusKm?: number,
  ): Promise<DemandSnapshot | null> {
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        ...(radiusKm ? { radiusKm: String(radiusKm) } : {}),
      });

      const response = await apiClient.get(`/rides/demand?${params.toString()}`);
      return (response.data?.data as DemandSnapshot) ?? null;
    } catch (error) {
      log.warn('Could not load demand', { error: String(error) });
      return null;
    }
  }
}

export default DemandService.getInstance();
