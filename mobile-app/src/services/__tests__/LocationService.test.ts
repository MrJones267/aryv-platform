/**
 * @fileoverview Tests for LocationService
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import locationService, { LocationService } from '../LocationService';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

// Mock the dependencies
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
  PermissionsAndroid: {
    request: jest.fn(),
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
    },
  },
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('@react-native-community/geolocation');

describe('LocationService', () => {
  const mockGeolocation = Geolocation as jest.Mocked<typeof Geolocation>;
  const mockPermissionsAndroid = PermissionsAndroid as jest.Mocked<typeof PermissionsAndroid>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestLocationPermission', () => {
    it('requests permission on Android', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('granted');
      
      const result = await locationService.requestLocationPermission();
      
      expect(mockPermissionsAndroid.request).toHaveBeenCalledWith(
        'android.permission.ACCESS_FINE_LOCATION',
        expect.any(Object)
      );
      expect(result).toBe(true);
    });

    it('returns false when permission is denied', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('denied');
      
      const result = await locationService.requestLocationPermission();
      
      expect(result).toBe(false);
    });

    it('returns true on iOS (permissions handled automatically)', async () => {
      // Temporarily mock iOS
      (Platform as any).OS = 'ios';
      
      const result = await locationService.requestLocationPermission();
      
      expect(result).toBe(true);
      expect(mockPermissionsAndroid.request).not.toHaveBeenCalled();
      
      // Reset to Android
      (Platform as any).OS = 'android';
    });

    it('handles permission request errors', async () => {
      mockPermissionsAndroid.request.mockRejectedValue(new Error('Permission error'));
      
      const result = await locationService.requestLocationPermission();
      
      expect(result).toBe(false);
    });
  });

  describe('getCurrentLocation', () => {
    it('gets current location successfully', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('granted');
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      });

      const location = await locationService.getCurrentLocation();

      expect(location.latitude).toBe(37.7749);
      expect(location.longitude).toBe(-122.4194);
      expect(location.accuracy).toBe(10);
    });

    it('throws error when permission is denied', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('denied');

      await expect(locationService.getCurrentLocation()).rejects.toThrow('Location permission denied');
    });

    it('handles geolocation errors', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('granted');
      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        error!({ code: 2, message: 'Position unavailable' } as any);
      });

      await expect(locationService.getCurrentLocation()).rejects.toThrow('Location unavailable');
    });

    it('uses custom options', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('granted');
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 5,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      });

      const options = {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60000,
      };

      await locationService.getCurrentLocation(options);

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining(options)
      );
    });
  });

  describe('startWatchingLocation', () => {
    it('starts watching location successfully', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('granted');
      mockGeolocation.watchPosition.mockReturnValue(123);

      const callback = jest.fn();
      await locationService.startWatchingLocation(callback);

      expect(mockGeolocation.watchPosition).toHaveBeenCalled();
    });

    it('throws error when permission is denied', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('denied');

      const callback = jest.fn();
      await expect(locationService.startWatchingLocation(callback)).rejects.toThrow('Location permission denied');
    });

    it('adds multiple callbacks', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('granted');
      mockGeolocation.watchPosition.mockReturnValue(123);

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await locationService.startWatchingLocation(callback1);
      await locationService.startWatchingLocation(callback2);

      // Should only call watchPosition once but add both callbacks
      expect(mockGeolocation.watchPosition).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopWatchingLocation', () => {
    it('stops watching when no callbacks remain', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('granted');
      mockGeolocation.watchPosition.mockReturnValue(123);
      mockGeolocation.clearWatch.mockImplementation(() => {});

      const callback = jest.fn();
      await locationService.startWatchingLocation(callback);
      locationService.stopWatchingLocation();

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(123);
    });

    it('does not stop watching when other callbacks remain', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('granted');
      mockGeolocation.watchPosition.mockReturnValue(123);
      mockGeolocation.clearWatch.mockImplementation(() => {});

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await locationService.startWatchingLocation(callback1);
      await locationService.startWatchingLocation(callback2);
      locationService.stopWatchingLocation(callback1);

      expect(mockGeolocation.clearWatch).not.toHaveBeenCalled();
    });
  });

  describe('calculateDistance', () => {
    it('calculates distance between two points', () => {
      const point1 = { latitude: 37.7749, longitude: -122.4194 };
      const point2 = { latitude: 37.7849, longitude: -122.4094 };

      const distance = locationService.calculateDistance(point1, point2);

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(20); // Should be less than 20km for nearby points
    });

    it('returns 0 for identical points', () => {
      const point = { latitude: 37.7749, longitude: -122.4194 };

      const distance = locationService.calculateDistance(point, point);

      expect(distance).toBe(0);
    });
  });

  describe('calculateBearing', () => {
    it('calculates bearing between two points', () => {
      const point1 = { latitude: 37.7749, longitude: -122.4194 };
      const point2 = { latitude: 37.7849, longitude: -122.4094 };

      const bearing = locationService.calculateBearing(point1, point2);

      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    });
  });

  describe('isWithinGeofence', () => {
    it('returns true when point is within geofence', () => {
      const point = { latitude: 37.7749, longitude: -122.4194 };
      const geofence = {
        center: { latitude: 37.7750, longitude: -122.4195 },
        radius: 100, // 100 meters
        identifier: 'test-geofence',
      };

      const isWithin = locationService.isWithinGeofence(point, geofence);

      expect(isWithin).toBe(true);
    });

    it('returns false when point is outside geofence', () => {
      const point = { latitude: 37.7749, longitude: -122.4194 };
      const geofence = {
        center: { latitude: 37.8049, longitude: -122.4594 },
        radius: 100, // 100 meters
        identifier: 'test-geofence',
      };

      const isWithin = locationService.isWithinGeofence(point, geofence);

      expect(isWithin).toBe(false);
    });
  });

  describe('reverseGeocode', () => {
    it('returns mock address data', async () => {
      const address = await locationService.reverseGeocode(37.7749, -122.4194);

      expect(address).toHaveProperty('fullAddress');
      expect(address).toHaveProperty('street');
      expect(address).toHaveProperty('city');
      expect(address).toHaveProperty('state');
      expect(address).toHaveProperty('country');
      expect(address).toHaveProperty('postalCode');
    });
  });

  describe('geocodeAddress', () => {
    it('returns mock coordinate data', async () => {
      const results = await locationService.geocodeAddress('123 Main St, San Francisco, CA');

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('latitude');
      expect(results[0]).toHaveProperty('longitude');
    });
  });

  describe('getCachedLocation', () => {
    it('returns null initially', () => {
      const cached = locationService.getCachedLocation();
      expect(cached).toBeNull();
    });

    it('returns cached location after getting current location', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('granted');
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      });

      await locationService.getCurrentLocation();
      const cached = locationService.getCachedLocation();

      expect(cached).not.toBeNull();
      expect(cached?.latitude).toBe(37.7749);
      expect(cached?.longitude).toBe(-122.4194);
    });
  });

  describe('clearCache', () => {
    it('clears cached location', async () => {
      mockPermissionsAndroid.request.mockResolvedValue('granted');
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      });

      await locationService.getCurrentLocation();
      expect(locationService.getCachedLocation()).not.toBeNull();

      locationService.clearCache();
      expect(locationService.getCachedLocation()).toBeNull();
    });
  });
});