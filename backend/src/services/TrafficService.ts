/**
 * @fileoverview Traffic conditions on a route, from Google's live data.
 * @author Oabona-Majoko
 * @created 2026-08-24
 * @lastModified 2026-08-24
 *
 * The app previously showed a traffic panel — a congestion level and an
 * estimated delay in minutes — computed from `Math.random()` and a hardcoded
 * time-of-day curve. It looked like a live reading and was not one.
 *
 * This asks Google, which does have the data. The Distance Matrix API returns
 * two durations for a journey: `duration`, the free-flow time, and
 * `duration_in_traffic`, the time given current conditions. The ratio between
 * them *is* congestion — no model needed, and the delay in minutes is simply
 * the difference.
 *
 * When no API key is configured this returns null rather than a guess, and
 * callers show nothing rather than a fabricated panel. That is the whole
 * lesson of what it replaces.
 */

import axios from 'axios';
import { logWarning } from '../utils/logger';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type CongestionLevel = 'light' | 'moderate' | 'heavy' | 'severe';

export interface TrafficConditions {
  level: CongestionLevel;
  /** Minutes added by traffic versus a clear road. */
  delayMinutes: number;
  /** Journey time in current conditions, minutes. */
  durationMinutes: number;
  /** Journey time on a clear road, minutes. */
  freeFlowMinutes: number;
  distanceKm: number;
  /** Always 'google' today; recorded so a reading is never mistaken for ours. */
  source: 'google';
}

const API_KEY = process.env['GOOGLE_MAPS_API_KEY'] || process.env['GOOGLE_DIRECTIONS_API_KEY'] || '';
const ENDPOINT = 'https://maps.googleapis.com/maps/api/distancematrix/json';

/** Google is a third party on a request path; do not wait indefinitely. */
const TIMEOUT_MS = 5000;

export const isTrafficConfigured = (): boolean => Boolean(API_KEY);

/**
 * Congestion as a ratio of actual to free-flow time.
 *
 * A journey taking a tenth longer than a clear road is ordinary; taking twice
 * as long is severe. The thresholds are deliberately coarse — the honest
 * resolution of this signal is four buckets, not a percentage.
 */
const levelFor = (ratio: number): CongestionLevel => {
  if (ratio >= 1.8) return 'severe';
  if (ratio >= 1.4) return 'heavy';
  if (ratio >= 1.15) return 'moderate';
  return 'light';
};

export class TrafficService {
  /**
   * Traffic on a route, or null.
   *
   * Null means "we do not know" — no key configured, Google unreachable, or no
   * route found. Callers must render nothing in that case rather than
   * substituting a plausible-looking value.
   */
  async forRoute(
    origin: Coordinates,
    destination: Coordinates,
    departureTime?: Date,
  ): Promise<TrafficConditions | null> {
    if (!API_KEY) {
      return null;
    }

    try {
      // Google rejects a departure time in the past; 'now' is the correct
      // request for a journey that has already started.
      const departure = departureTime && departureTime.getTime() > Date.now()
        ? Math.floor(departureTime.getTime() / 1000)
        : 'now';

      const response = await axios.get(ENDPOINT, {
        timeout: TIMEOUT_MS,
        params: {
          origins: `${origin.latitude},${origin.longitude}`,
          destinations: `${destination.latitude},${destination.longitude}`,
          departure_time: departure,
          // Without this Google returns only free-flow time, and the whole
          // reading collapses to "no traffic, ever".
          traffic_model: 'best_guess',
          key: API_KEY,
        },
      });

      const element = response.data?.rows?.[0]?.elements?.[0];

      if (!element || element.status !== 'OK') {
        return null;
      }

      const freeFlowSeconds = Number(element.duration?.value);
      // Falls back to free-flow when Google has no traffic data for the area,
      // which yields a ratio of 1 and a 'light' reading — true, not invented.
      const trafficSeconds = Number(element.duration_in_traffic?.value ?? freeFlowSeconds);
      const distanceMetres = Number(element.distance?.value);

      if (!Number.isFinite(freeFlowSeconds) || freeFlowSeconds <= 0) {
        return null;
      }

      const ratio = trafficSeconds / freeFlowSeconds;

      return {
        level: levelFor(ratio),
        delayMinutes: Math.max(0, Math.round((trafficSeconds - freeFlowSeconds) / 60)),
        durationMinutes: Math.round(trafficSeconds / 60),
        freeFlowMinutes: Math.round(freeFlowSeconds / 60),
        distanceKm: Number.isFinite(distanceMetres)
          ? Math.round((distanceMetres / 1000) * 10) / 10
          : 0,
        source: 'google',
      };
    } catch (error) {
      logWarning('Could not read traffic conditions', {
        error: error instanceof Error ? error.message : String(error),
      });

      return null;
    }
  }
}

export const trafficService = new TrafficService();
export default trafficService;
