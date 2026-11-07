/**
 * @fileoverview Google's geocoding, place-search and directions replies, via the ARYV API
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * The app used to call Google's web services itself, with a key built into
 * the APK. Google lets those services be restricted only by IP address, so
 * that key could never be locked to the app. The ARYV API now makes the
 * calls with its own key (GET /api/locations/google/:service) and returns
 * Google's reply unchanged, so the parsing at each call site is as before.
 *
 * The map view itself still uses the Maps SDK key in strings.xml, which is
 * restricted to this app's package and signing certificates.
 */

import { ApiClient } from './ApiClient';

export type GoogleMapsService = 'geocode' | 'autocomplete' | 'details' | 'directions';

/** The fields every Google web-service reply carries. */
export interface GoogleReply {
  status: string;
  error_message?: string;
  [field: string]: unknown;
}

const client = new ApiClient();

/**
 * Google's reply for one call. When the ARYV API cannot be reached or
 * refuses, the reply is shaped like a Google failure, so every caller's
 * existing `status !== 'OK'` handling covers it.
 */
export async function googleMaps(
  service: GoogleMapsService,
  params: Record<string, string>,
): Promise<GoogleReply> {
  const query = new URLSearchParams(params).toString();
  const response = await client.get(`/locations/google/${service}?${query}`);
  if (!response.success || !response.data || typeof response.data.status !== 'string') {
    return { status: 'REQUEST_FAILED', error_message: response.error ?? 'Map service unavailable' };
  }
  return response.data as GoogleReply;
}
