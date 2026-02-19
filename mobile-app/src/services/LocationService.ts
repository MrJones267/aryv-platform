/**
 * @fileoverview Location service for handling geolocation and mapping features
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import logger from './LoggingService';

const log = logger.createLogger('LocationService');

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp?: number;
}

export interface LocationAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  fullAddress: string;
  formatted?: string;
}

export interface LocationData extends LocationCoordinates {
  address?: LocationAddress;
}

export interface GeofenceOptions {
  center: LocationCoordinates;
  radius: number; // in meters
  identifier: string;
}

export class LocationService {
  private watchId: number | null = null;
  private currentLocation: LocationData | null = null;
  private locationCallbacks: Array<(location: LocationData) => void> = [];

  /**
   * Request location permissions based on platform
   */
  async requestLocationPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Hitch needs access to your location to show nearby rides and provide navigation.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        // iOS permissions are handled automatically by the library
        return true;
      }
    } catch (error) {
      log.error('Error requesting location permission', error);
      return false;
    }
  }

  /**
   * Get current location once
   */
  async getCurrentLocation(
    options: {
      timeout?: number;
      maximumAge?: number;
      enableHighAccuracy?: boolean;
    } = {}
  ): Promise<LocationData> {
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) {
      throw new Error('Location permission denied');
    }

    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        async (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: position.timestamp,
          };

          try {
            // Get address for the location
            const address = await this.reverseGeocode(
              locationData.latitude,
              locationData.longitude
            );
            locationData.address = address;
          } catch (error) {
            log.warn('Failed to get address for location:', error);
          }

          this.currentLocation = locationData;
          resolve(locationData);
        },
        (error) => {
          log.error('Error getting current location:', error);
          reject(this.handleLocationError(error));
        },
        {
          enableHighAccuracy: options.enableHighAccuracy ?? true,
          timeout: options.timeout ?? 15000,
          maximumAge: options.maximumAge ?? 300000, // 5 minutes
        }
      );
    });
  }

  /**
   * Start watching location changes
   */
  async startWatchingLocation(
    callback: (location: LocationData) => void,
    options: {
      distanceFilter?: number;
      timeout?: number;
      maximumAge?: number;
      enableHighAccuracy?: boolean;
    } = {}
  ): Promise<void> {
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) {
      throw new Error('Location permission denied');
    }

    this.locationCallbacks.push(callback);

    if (this.watchId === null) {
      this.watchId = Geolocation.watchPosition(
        async (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: position.timestamp,
          };

          try {
            // Get address for the location (optional for watch mode)
            const address = await this.reverseGeocode(
              locationData.latitude,
              locationData.longitude
            );
            locationData.address = address;
          } catch (error) {
            // Silently handle address lookup failures for continuous tracking
          }

          this.currentLocation = locationData;
          
          // Notify all callbacks
          this.locationCallbacks.forEach(cb => cb(locationData));
        },
        (error) => {
          log.error('Error watching location:', error);
          Alert.alert('Location Error', this.handleLocationError(error).message);
        },
        {
          enableHighAccuracy: options.enableHighAccuracy ?? true,
          timeout: options.timeout ?? 15000,
          maximumAge: options.maximumAge ?? 60000, // 1 minute for watch mode
          distanceFilter: options.distanceFilter ?? 10, // 10 meters
        }
      );
    }
  }

  /**
   * Stop watching location changes
   */
  stopWatchingLocation(callback?: (location: LocationData) => void): void {
    if (callback) {
      this.locationCallbacks = this.locationCallbacks.filter(cb => cb !== callback);
    } else {
      this.locationCallbacks = [];
    }

    if (this.locationCallbacks.length === 0 && this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<LocationAddress> {
    try {
      const { APP_CONFIG } = await import('../config/api');
      const GOOGLE_MAPS_API_KEY = APP_CONFIG.GOOGLE_SERVICES.GEOCODING_API_KEY;
      
      // Check if we have a valid API key
      if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY.includes('YOUR_PRODUCTION') || GOOGLE_MAPS_API_KEY === 'placeholder') {
        log.warn('Google Maps API key not configured, using fallback geocoding');
        return this.fallbackReverseGeocode(latitude, longitude);
      }
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&language=${APP_CONFIG.GOOGLE_SERVICES.DEFAULT_LANGUAGE}`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const components = result.address_components;
        
        // Parse address components
        const address: LocationAddress = {
          fullAddress: result.formatted_address,
          formatted: result.formatted_address,
        };
        
        // Extract specific components
        components.forEach((component: { types: string[]; long_name: string; short_name: string }) => {
          const types = component.types;
          
          if (types.includes('street_number')) {
            address.street = (address.street || '') + component.long_name + ' ';
          }
          if (types.includes('route')) {
            address.street = (address.street || '') + component.long_name;
          }
          if (types.includes('locality')) {
            address.city = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            address.state = component.short_name;
          }
          if (types.includes('country')) {
            address.country = component.short_name;
          }
          if (types.includes('postal_code')) {
            address.postalCode = component.long_name;
          }
        });
        
        return address;
      } else {
        throw new Error('No address found for coordinates');
      }
    } catch (error) {
      log.error('Reverse geocoding failed:', error);
      
      // Fallback to basic address format if API fails
      return {
        street: 'Unknown Location',
        city: 'Unknown City',
        state: '',
        country: '',
        postalCode: '',
        fullAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      };
    }
  }

  /**
   * Forward geocode address to coordinates (single coordinate pair for package service)
   */
  async geocodeAddress(address: string): Promise<[number, number] | null> {
    const results = await this.geocodeAddressDetailed(address);
    if (results.length > 0) {
      return [results[0].longitude, results[0].latitude];
    }
    return null;
  }

  /**
   * Verify if current location is within acceptable range of target location
   */
  async verifyLocationProximity(
    targetLatitude: number,
    targetLongitude: number,
    maxDistanceMeters: number = 100
  ): Promise<{
    isWithinRange: boolean;
    distance: number;
    accuracy: number;
    currentLocation: LocationCoordinates;
  }> {
    try {
      const currentLocation = await this.getCurrentLocation();
      const distance = this.calculateDistance(
        currentLocation,
        { latitude: targetLatitude, longitude: targetLongitude }
      ) * 1000; // Convert km to meters
      
      return {
        isWithinRange: distance <= maxDistanceMeters,
        distance: Math.round(distance),
        accuracy: currentLocation.accuracy || 0,
        currentLocation,
      };
    } catch (error) {
      log.error('Error verifying location proximity:', error);
      throw new Error('Unable to verify location proximity');
    }
  }

  /**
   * Forward geocode address to detailed coordinates (array format for multiple results)
   */
  async geocodeAddressDetailed(address: string): Promise<LocationCoordinates[]> {
    try {
      const { APP_CONFIG } = await import('../config/api');
      const GOOGLE_GEOCODING_API_KEY = APP_CONFIG.GOOGLE_SERVICES.GEOCODING_API_KEY;
      
      // Check if we have a valid API key
      if (!GOOGLE_GEOCODING_API_KEY || GOOGLE_GEOCODING_API_KEY.includes('YOUR_PRODUCTION') || GOOGLE_GEOCODING_API_KEY === 'placeholder') {
        log.warn('Google Geocoding API key not configured, using fallback geocoding');
        return this.fallbackGeocodeDetailed(address);
      }
      
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_GEOCODING_API_KEY}&language=${APP_CONFIG.GOOGLE_SERVICES.DEFAULT_LANGUAGE}&region=${APP_CONFIG.GOOGLE_SERVICES.DEFAULT_REGION}`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const results: LocationCoordinates[] = data.results.map((result: { geometry: { location: { lat: number; lng: number }; location_type: string } }) => ({
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          accuracy: result.geometry.location_type === 'ROOFTOP' ? 10 : 
                    result.geometry.location_type === 'RANGE_INTERPOLATED' ? 25 :
                    result.geometry.location_type === 'GEOMETRIC_CENTER' ? 50 : 100,
        }));
        
        return results;
      } else {
        log.warn('Google Geocoding failed:', { status: data.status, error: data.error_message });
        return this.fallbackGeocodeDetailed(address);
      }
    } catch (error) {
      log.error('Geocoding failed:', error);
      return this.fallbackGeocodeDetailed(address);
    }
  }

  /**
   * Calculate distance between two points in kilometers
   */
  calculateDistance(
    point1: LocationCoordinates,
    point2: LocationCoordinates
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) *
        Math.cos(this.toRadians(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate bearing from point1 to point2
   */
  calculateBearing(
    point1: LocationCoordinates,
    point2: LocationCoordinates
  ): number {
    const dLon = this.toRadians(point2.longitude - point1.longitude);
    const lat1 = this.toRadians(point1.latitude);
    const lat2 = this.toRadians(point2.latitude);

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    const bearing = this.toDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360;
  }

  /**
   * Check if a point is within a geofence
   */
  isWithinGeofence(
    point: LocationCoordinates,
    geofence: GeofenceOptions
  ): boolean {
    const distance = this.calculateDistance(point, geofence.center);
    return distance * 1000 <= geofence.radius; // Convert km to meters
  }

  /**
   * Get cached current location
   */
  getCachedLocation(): LocationData | null {
    return this.currentLocation;
  }

  /**
   * Clear cached location
   */
  clearCache(): void {
    this.currentLocation = null;
  }

  /**
   * Fallback geocoding when Google API is unavailable
   */
  private fallbackGeocodeDetailed(address: string): LocationCoordinates[] {
    // Simple fallback based on known addresses or return default coordinates
    const lowerAddress = address.toLowerCase();

    // Southern Africa city coordinates (Botswana + neighbouring countries)
    const cityCoordinates: Record<string, LocationCoordinates> = {
      'gaborone': { latitude: -24.6282, longitude: 25.9231, accuracy: 50 },
      'francistown': { latitude: -21.1700, longitude: 27.5073, accuracy: 50 },
      'maun': { latitude: -19.9833, longitude: 23.4167, accuracy: 50 },
      'kasane': { latitude: -17.7953, longitude: 25.1531, accuracy: 50 },
      'nata': { latitude: -20.2167, longitude: 26.2167, accuracy: 50 },
      'palapye': { latitude: -22.4000, longitude: 27.1333, accuracy: 50 },
      'serowe': { latitude: -22.3833, longitude: 26.7167, accuracy: 50 },
      'mahalapye': { latitude: -23.1000, longitude: 26.8167, accuracy: 50 },
      'molepolole': { latitude: -24.4000, longitude: 25.5000, accuracy: 50 },
      'kanye': { latitude: -24.9667, longitude: 25.3500, accuracy: 50 },
      'lobatse': { latitude: -25.2167, longitude: 25.6833, accuracy: 50 },
      'selibe phikwe': { latitude: -21.9833, longitude: 27.8167, accuracy: 50 },
      'selebi-phikwe': { latitude: -21.9833, longitude: 27.8167, accuracy: 50 },
      'jwaneng': { latitude: -24.6000, longitude: 24.7333, accuracy: 50 },
      'orapa': { latitude: -21.3167, longitude: 25.3833, accuracy: 50 },
      'letlhakane': { latitude: -21.4167, longitude: 25.5833, accuracy: 50 },
      'tshabong': { latitude: -26.0000, longitude: 22.4000, accuracy: 50 },
      'ghanzi': { latitude: -21.7000, longitude: 21.6833, accuracy: 50 },
      // Neighbouring cities for cross-border routes
      'johannesburg': { latitude: -26.2041, longitude: 28.0473, accuracy: 50 },
      'pretoria': { latitude: -25.7461, longitude: 28.1881, accuracy: 50 },
      'windhoek': { latitude: -22.5609, longitude: 17.0658, accuracy: 50 },
      'harare': { latitude: -17.8252, longitude: 31.0335, accuracy: 50 },
      'bulawayo': { latitude: -20.1325, longitude: 28.5780, accuracy: 50 },
      'lusaka': { latitude: -15.3875, longitude: 28.3228, accuracy: 50 },
      'livingstone': { latitude: -17.8419, longitude: 25.8544, accuracy: 50 },
    };

    for (const [city, coords] of Object.entries(cityCoordinates)) {
      if (lowerAddress.includes(city)) {
        log.info(`LocationService: Using fallback coordinates for ${city}`);
        return [coords];
      }
    }

    // Default to Gaborone, Botswana
    log.warn('LocationService: No fallback coordinates found, using default Gaborone location');
    return [{ latitude: -24.6282, longitude: 25.9231, accuracy: 50 }];
  }

  /**
   * Fallback reverse geocoding when Google API is unavailable
   */
  private fallbackReverseGeocode(
    latitude: number,
    longitude: number
  ): LocationAddress {
    // Create a basic address based on coordinates
    // This would typically use a secondary service like OpenStreetMap Nominatim
    // For now, we'll provide a formatted coordinate-based address
    const lat = latitude.toFixed(6);
    const lng = longitude.toFixed(6);
    
    return {
      street: `Location near ${lat}, ${lng}`,
      city: 'Unknown City',
      state: '',
      country: '',
      postalCode: '',
      fullAddress: `${lat}, ${lng}`,
      formatted: `Coordinates: ${lat}, ${lng}`,
    };
  }

  /**
   * Fallback geocoding when Google API is unavailable
   */
  private fallbackGeocode(address: string): LocationCoordinates[] {
    // Delegate to fallbackGeocodeDetailed for consistent Botswana city lookup
    log.warn('Using fallback geocoding for:', address);
    return this.fallbackGeocodeDetailed(address);
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  private handleLocationError(error: unknown): Error {
    const code = (error as { code?: number })?.code;
    switch (code) {
      case 1:
        return new Error('Location permission denied');
      case 2:
        return new Error('Location unavailable');
      case 3:
        return new Error('Location request timed out');
      default:
        return new Error('An unknown location error occurred');
    }
  }
}

export const locationService = new LocationService();
export default locationService;