/**
 * @fileoverview Location service for handling geolocation and mapping features
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform, Alert } from 'react-native';

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

class LocationService {
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
      console.error('Error requesting location permission:', error);
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
            console.warn('Failed to get address for location:', error);
          }

          this.currentLocation = locationData;
          resolve(locationData);
        },
        (error) => {
          console.error('Error getting current location:', error);
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
          console.error('Error watching location:', error);
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
      // Note: This is a placeholder implementation
      // In a real app, you would use a geocoding service like:
      // - Google Maps Geocoding API
      // - Mapbox Geocoding API
      // - Here Geocoding API
      
      // Mock implementation for development
      const mockAddress: LocationAddress = {
        street: `${Math.floor(latitude * 1000)} Main St`,
        city: 'Downtown',
        state: 'CA',
        country: 'US',
        postalCode: '90210',
        fullAddress: `${Math.floor(latitude * 1000)} Main St, Downtown, CA 90210, US`,
      };

      return mockAddress;
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      throw new Error('Failed to get address for location');
    }
  }

  /**
   * Forward geocode address to coordinates
   */
  async geocodeAddress(address: string): Promise<LocationCoordinates[]> {
    try {
      // Note: This is a placeholder implementation
      // In a real app, you would use a geocoding service
      
      // Mock implementation for development
      const mockResults: LocationCoordinates[] = [
        {
          latitude: 34.0522 + (Math.random() - 0.5) * 0.1,
          longitude: -118.2437 + (Math.random() - 0.5) * 0.1,
          accuracy: 10,
        },
      ];

      return mockResults;
    } catch (error) {
      console.error('Geocoding failed:', error);
      throw new Error('Failed to find coordinates for address');
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

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  private handleLocationError(error: any): Error {
    switch (error.code) {
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