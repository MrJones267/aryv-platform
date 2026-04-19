/**
 * @fileoverview Google Maps API service for geocoding, places search, and routing
 * @author Oabona-Majoko
 * @created 2026-03-27
 * @lastModified 2026-03-27
 */

import axios from 'axios';
import logger from '../utils/logger';

const GOOGLE_API_KEY = process.env['GOOGLE_MAPS_API_KEY'] || '';
const MAPS_BASE = 'https://maps.googleapis.com/maps/api';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  location: LatLng;
  types: string[];
  rating?: number;
  distance?: number;
}

interface RouteResult {
  distance: number; // km
  duration: number; // minutes
  polyline: string;
  legs: Array<{
    distance: number;
    duration: number;
    startLocation: LatLng;
    endLocation: LatLng;
  }>;
}

class GoogleMapsService {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = GOOGLE_API_KEY;
    if (!this.apiKey) {
      logger.warn('GOOGLE_MAPS_API_KEY not set - location services will use fallback responses');
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<any> {
    if (!this.apiKey) return this.mockAddress(latitude, longitude);

    try {
      const response = await axios.get(`${MAPS_BASE}/geocode/json`, {
        params: { latlng: `${latitude},${longitude}`, key: this.apiKey },
        timeout: 5000,
      });

      const data = response.data;
      if (data.status !== 'OK' || !data.results?.length) {
        logger.warn('Google reverse geocode returned no results', { status: data.status });
        return this.mockAddress(latitude, longitude);
      }

      const result = data.results[0];
      const components = result.address_components || [];

      const getComponent = (type: string) =>
        components.find((c: any) => c.types.includes(type))?.long_name || '';

      return {
        formattedAddress: result.formatted_address,
        components: {
          streetNumber: getComponent('street_number'),
          streetName: getComponent('route'),
          neighborhood: getComponent('sublocality') || getComponent('neighborhood'),
          city: getComponent('locality') || getComponent('administrative_area_level_2'),
          state: getComponent('administrative_area_level_1'),
          postalCode: getComponent('postal_code'),
          country: getComponent('country'),
          countryCode: components.find((c: any) => c.types.includes('country'))?.short_name || '',
        },
        location: { latitude, longitude },
        accuracy: result.geometry?.location_type || 'APPROXIMATE',
        locationType: result.geometry?.location_type || 'GEOMETRIC_CENTER',
        placeId: result.place_id,
      };
    } catch (error) {
      logger.error('Google Maps reverseGeocode error', { error: (error as Error).message });
      return this.mockAddress(latitude, longitude);
    }
  }

  async searchPlaces(query: string, latitude?: number, longitude?: number, radius = 10): Promise<PlaceResult[]> {
    if (!this.apiKey) return this.mockPlaces(query, latitude, longitude);

    try {
      const params: any = { input: query, key: this.apiKey, inputtype: 'textquery', fields: 'place_id,name,formatted_address,geometry,types,rating' };
      if (latitude && longitude) {
        params.locationbias = `circle:${radius * 1000}@${latitude},${longitude}`;
      }

      const response = await axios.get(`${MAPS_BASE}/place/findplacefromtext/json`, { params, timeout: 5000 });
      const data = response.data;

      if (data.status !== 'OK' || !data.candidates?.length) {
        return this.mockPlaces(query, latitude, longitude);
      }

      return data.candidates.map((place: any) => {
        const loc = place.geometry?.location || {};
        const plat = loc.lat || latitude || 0;
        const plng = loc.lng || longitude || 0;
        const dist = latitude && longitude
          ? this.haversineDistance(latitude, longitude, plat, plng)
          : undefined;

        return {
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address || place.name,
          location: { latitude: plat, longitude: plng },
          types: place.types || [],
          rating: place.rating,
          distance: dist,
        };
      });
    } catch (error) {
      logger.error('Google Maps searchPlaces error', { error: (error as Error).message });
      return this.mockPlaces(query, latitude, longitude);
    }
  }

  async calculateRoute(
    waypoints: Array<LatLng & { address?: string }>,
    _routeType = 'fastest',
    avoidTolls = false,
    avoidHighways = false
  ): Promise<RouteResult> {
    if (!this.apiKey || waypoints.length < 2) return this.mockRoute(waypoints);

    try {
      const origin = `${waypoints[0].latitude},${waypoints[0].longitude}`;
      const destination = `${waypoints[waypoints.length - 1].latitude},${waypoints[waypoints.length - 1].longitude}`;
      const avoid: string[] = [];
      if (avoidTolls) avoid.push('tolls');
      if (avoidHighways) avoid.push('highways');

      const params: any = {
        origin,
        destination,
        key: this.apiKey,
        units: 'metric',
      };
      if (waypoints.length > 2) {
        params.waypoints = waypoints.slice(1, -1).map((w) => `${w.latitude},${w.longitude}`).join('|');
      }
      if (avoid.length) params.avoid = avoid.join('|');

      const response = await axios.get(`${MAPS_BASE}/directions/json`, { params, timeout: 8000 });
      const data = response.data;

      if (data.status !== 'OK' || !data.routes?.length) {
        logger.warn('Google Directions API returned no routes', { status: data.status });
        return this.mockRoute(waypoints);
      }

      const route = data.routes[0];
      const totalDistance = route.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0) / 1000;
      const totalDuration = route.legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0) / 60;

      return {
        distance: Math.round(totalDistance * 10) / 10,
        duration: Math.round(totalDuration),
        polyline: route.overview_polyline?.points || '',
        legs: route.legs.map((leg: any) => ({
          distance: Math.round((leg.distance.value / 1000) * 10) / 10,
          duration: Math.round(leg.duration.value / 60),
          startLocation: { latitude: leg.start_location.lat, longitude: leg.start_location.lng },
          endLocation: { latitude: leg.end_location.lat, longitude: leg.end_location.lng },
        })),
      };
    } catch (error) {
      logger.error('Google Maps calculateRoute error', { error: (error as Error).message });
      return this.mockRoute(waypoints);
    }
  }

  async getETA(origin: LatLng, destination: LatLng): Promise<{ duration: number; distance: number }> {
    const route = await this.calculateRoute([origin, destination]);
    return { duration: route.duration, distance: route.distance };
  }

  haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private mockAddress(latitude: number, longitude: number): any {
    return {
      formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      components: { streetNumber: '', streetName: '', neighborhood: '', city: '', state: '', postalCode: '', country: '', countryCode: '' },
      location: { latitude, longitude },
      accuracy: 'APPROXIMATE',
      locationType: 'GEOMETRIC_CENTER',
    };
  }

  private mockPlaces(query: string, lat?: number, lng?: number): PlaceResult[] {
    return [
      {
        placeId: `mock-${Date.now()}`,
        name: query,
        address: `Results for "${query}"`,
        location: { latitude: lat || 0, longitude: lng || 0 },
        types: ['establishment'],
        distance: 0,
      },
    ];
  }

  private mockRoute(waypoints: LatLng[]): RouteResult {
    const dist = waypoints.length >= 2
      ? this.haversineDistance(waypoints[0].latitude, waypoints[0].longitude, waypoints[waypoints.length - 1].latitude, waypoints[waypoints.length - 1].longitude)
      : 5;
    return {
      distance: Math.round(dist * 10) / 10,
      duration: Math.round((dist / 40) * 60), // assume 40 km/h average
      polyline: '',
      legs: [
        {
          distance: Math.round(dist * 10) / 10,
          duration: Math.round((dist / 40) * 60),
          startLocation: waypoints[0] || { latitude: 0, longitude: 0 },
          endLocation: waypoints[waypoints.length - 1] || { latitude: 0, longitude: 0 },
        },
      ],
    };
  }
}

export const googleMapsService = new GoogleMapsService();
export default googleMapsService;
