/**
 * @fileoverview The app's Google web-service calls, made with the server's key
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * The app used to call Google's Geocoding, Places and Directions web services
 * itself, with a key shipped inside the APK (and committed to the public
 * repository). Google lets a web-service key be restricted only by IP
 * address, never to an Android app, so that key could not be locked down:
 * anyone could lift it and spend on ARYV's account.
 *
 * The app now asks this server instead. Each call forwards a fixed list of
 * parameters, adds the server's own key (restricted to these APIs and never
 * sent to a client), and hands Google's reply back unchanged, so the app's
 * parsing stays exactly as it was. Nothing is invented on failure: Google's
 * own status comes back, and the app's existing "not found" handling applies.
 */

import axios from 'axios';
import logger from '../utils/logger';

const MAPS_BASE = 'https://maps.googleapis.com/maps/api';
const TIMEOUT_MS = 8000;

/** What the app may ask for, and the only parameters forwarded for each. */
export const GOOGLE_SERVICES = {
  geocode: {
    path: '/geocode/json',
    params: ['latlng', 'address', 'language', 'region', 'components'],
  },
  autocomplete: {
    path: '/place/autocomplete/json',
    params: ['input', 'components', 'language', 'sessiontoken', 'location', 'radius'],
  },
  details: {
    path: '/place/details/json',
    params: ['place_id', 'fields', 'sessiontoken', 'language'],
  },
  directions: {
    path: '/directions/json',
    params: [
      'origin', 'destination', 'waypoints', 'mode', 'alternatives', 'avoid',
      'departure_time', 'traffic_model', 'language', 'units', 'region',
    ],
  },
} as const;

export type GoogleService = keyof typeof GOOGLE_SERVICES;

/** Place details are billed per field group; only these are ever needed. */
const DETAIL_FIELDS = new Set(['geometry', 'name', 'formatted_address', 'place_id']);

const MAX_PARAM_LENGTH = 2000;

export const isGoogleService = (name: string): name is GoogleService =>
  Object.prototype.hasOwnProperty.call(GOOGLE_SERVICES, name);

/**
 * The parameters that will be sent to Google: the allowed ones, as single
 * strings, length-capped, with `fields` cut down to the cheap set.
 */
export const pickParams = (
  service: GoogleService,
  query: Record<string, unknown>,
): Record<string, string> => {
  const picked: Record<string, string> = {};
  for (const name of GOOGLE_SERVICES[service].params) {
    const value = query[name];
    if (typeof value !== 'string' || value === '' || value.length > MAX_PARAM_LENGTH) continue;
    picked[name] = value;
  }
  if (service === 'details') {
    const fields = (picked['fields'] ?? 'geometry,name,formatted_address')
      .split(',')
      .map((field) => field.trim())
      .filter((field) => DETAIL_FIELDS.has(field));
    picked['fields'] = fields.length > 0 ? fields.join(',') : 'geometry';
  }
  return picked;
};

/** What a call needs before it is worth sending to Google. */
export const missingParam = (service: GoogleService, params: Record<string, string>): string | null => {
  switch (service) {
    case 'geocode':
      return params['latlng'] || params['address'] ? null : 'latlng or address';
    case 'autocomplete':
      return params['input'] ? null : 'input';
    case 'details':
      return params['place_id'] ? null : 'place_id';
    case 'directions':
      return params['origin'] && params['destination'] ? null : 'origin and destination';
    default:
      return 'service';
  }
};

/**
 * Google's reply to one call, as Google sent it. Network failures come back
 * as Google-shaped errors so the app handles them like any other refusal.
 */
export const callGoogle = async (
  service: GoogleService,
  params: Record<string, string>,
): Promise<Record<string, unknown>> => {
  const key = process.env['GOOGLE_MAPS_API_KEY'];
  if (!key) {
    logger.error('GOOGLE_MAPS_API_KEY is not set; Google calls from the app cannot be served');
    return { status: 'REQUEST_DENIED', error_message: 'Maps are not configured on the server' };
  }

  try {
    const response = await axios.get(`${MAPS_BASE}${GOOGLE_SERVICES[service].path}`, {
      params: { ...params, key },
      timeout: TIMEOUT_MS,
    });
    const data = response.data as Record<string, unknown>;
    const status = data['status'];
    if (status !== 'OK' && status !== 'ZERO_RESULTS') {
      logger.warn('Google web service refused a request', {
        service,
        status,
        error: data['error_message'],
      });
    }
    return data;
  } catch (error) {
    logger.error('Google web service unreachable', { service, error: (error as Error).message });
    return { status: 'UNKNOWN_ERROR', error_message: 'Google could not be reached' };
  }
};
