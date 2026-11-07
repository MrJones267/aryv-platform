/**
 * @fileoverview How far a package travels, by road
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * Packages were priced on straight-line distance, which is shorter than the
 * road a courier drives: by a fifth to two fifths in town, and enough to
 * matter on any route that bends. The road distance comes from Google's
 * Distance Matrix (the server key is restricted to it, among others). When
 * Google cannot answer, the straight line is scaled by ROAD_FACTOR, an
 * ordinary detour ratio, rather than refusing to quote.
 */

import axios from 'axios';
import logger from '../utils/logger';

/** Typical road distance over straight-line distance. */
export const ROAD_FACTOR = 1.3;
const TIMEOUT_MS = 5000;

/** Great-circle distance in km between two [lng, lat] points. */
export const straightLineKm = (a: [number, number], b: [number, number]): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export interface RouteDistance {
  km: number;
  source: 'road' | 'estimated';
}

/** Driving distance in km between two [lng, lat] points, to 0.1 km. */
export async function roadDistanceKm(from: [number, number], to: [number, number]): Promise<RouteDistance> {
  const estimate = (): RouteDistance => ({
    km: Math.round(straightLineKm(from, to) * ROAD_FACTOR * 10) / 10,
    source: 'estimated',
  });
  const key = process.env['GOOGLE_MAPS_API_KEY'];
  if (!key) return estimate();

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        // Google takes lat,lng; the app and database use [lng, lat].
        origins: `${from[1]},${from[0]}`,
        destinations: `${to[1]},${to[0]}`,
        mode: 'driving',
        units: 'metric',
        key,
      },
      timeout: TIMEOUT_MS,
    });
    const element = response.data?.rows?.[0]?.elements?.[0];
    const metres = Number(element?.distance?.value);
    if (response.data?.status !== 'OK' || element?.status !== 'OK' || !Number.isFinite(metres)) {
      logger.warn('Road distance unavailable; estimating from the straight line', {
        status: response.data?.status,
        elementStatus: element?.status,
      });
      return estimate();
    }
    return { km: Math.round((metres / 1000) * 10) / 10, source: 'road' };
  } catch (error) {
    logger.warn('Road distance request failed; estimating from the straight line', {
      error: (error as Error).message,
    });
    return estimate();
  }
}
