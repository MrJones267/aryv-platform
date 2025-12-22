/**
 * @fileoverview Navigation service for turn-by-turn directions and route optimization
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import { LocationCoordinates } from './LocationService';

export interface NavigationRoute {
  coordinates: LocationCoordinates[];
  distance: number; // in meters
  duration: number; // in seconds
  instructions: NavigationInstruction[];
}

export interface NavigationInstruction {
  text: string;
  distance: number;
  duration: number;
  coordinate: LocationCoordinates;
  maneuver?: string;
}

export interface DirectionsRequest {
  origin: LocationCoordinates;
  destination: LocationCoordinates;
  waypoints?: LocationCoordinates[];
  mode?: 'driving' | 'walking' | 'transit';
  avoid?: ('tolls' | 'highways' | 'ferries')[];
  optimize?: boolean;
}

class NavigationService {
  private readonly GOOGLE_DIRECTIONS_API = 'https://maps.googleapis.com/maps/api/directions/json';
  
  /**
   * Get turn-by-turn directions between two points
   */
  async getDirections(request: DirectionsRequest): Promise<NavigationRoute> {
    try {
      // For development/testing, provide mock directions
      if (__DEV__ && !this.hasGoogleMapsApiKey()) {
        return this.getMockDirections(request);
      }

      const params = new URLSearchParams({
        origin: `${request.origin.latitude},${request.origin.longitude}`,
        destination: `${request.destination.latitude},${request.destination.longitude}`,
        mode: request.mode || 'driving',
        key: this.getGoogleMapsApiKey(),
      });

      if (request.waypoints && request.waypoints.length > 0) {
        const waypoints = request.waypoints
          .map(wp => `${wp.latitude},${wp.longitude}`)
          .join('|');
        params.append('waypoints', request.optimize ? `optimize:true|${waypoints}` : waypoints);
      }

      if (request.avoid && request.avoid.length > 0) {
        params.append('avoid', request.avoid.join('|'));
      }

      const response = await fetch(`${this.GOOGLE_DIRECTIONS_API}?${params.toString()}`);
      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Directions API error: ${data.status}`);
      }

      return this.parseDirectionsResponse(data);
    } catch (error) {
      console.error('Navigation Service Error:', error);
      // Fallback to mock directions
      return this.getMockDirections(request);
    }
  }

  /**
   * Open external navigation app (Google Maps, Apple Maps, etc.)
   */
  async openExternalNavigation(
    destination: LocationCoordinates,
    origin?: LocationCoordinates,
    mode: 'driving' | 'walking' | 'transit' = 'driving'
  ): Promise<void> {
    const { Linking, Platform } = require('react-native');
    
    try {
      let url: string;
      
      if (Platform.OS === 'ios') {
        // Use Apple Maps on iOS
        const params = new URLSearchParams({
          daddr: `${destination.latitude},${destination.longitude}`,
          dirflg: mode === 'walking' ? 'w' : mode === 'transit' ? 'r' : 'd',
        });
        
        if (origin) {
          params.append('saddr', `${origin.latitude},${origin.longitude}`);
        }
        
        url = `http://maps.apple.com/?${params.toString()}`;
      } else {
        // Use Google Maps on Android
        const params = new URLSearchParams({
          destination: `${destination.latitude},${destination.longitude}`,
          travelmode: mode,
        });
        
        if (origin) {
          params.append('origin', `${origin.latitude},${origin.longitude}`);
        }
        
        url = `google.navigation:q=${destination.latitude},${destination.longitude}`;
      }
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to browser-based Google Maps
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('External navigation error:', error);
      throw new Error('Failed to open navigation app');
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(
    point1: LocationCoordinates,
    point2: LocationCoordinates
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate estimated travel time based on distance and mode
   */
  calculateEstimatedTravelTime(
    distance: number,
    mode: 'driving' | 'walking' | 'transit' = 'driving'
  ): number {
    const speeds = {
      driving: 50000, // 50 km/h in m/h
      walking: 5000,  // 5 km/h in m/h
      transit: 30000, // 30 km/h in m/h (average with stops)
    };
    
    return Math.round((distance / speeds[mode]) * 3600); // Return seconds
  }

  private hasGoogleMapsApiKey(): boolean {
    // Check if Google Maps API key is configured
    return process.env.GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE';
  }

  private getGoogleMapsApiKey(): string {
    return process.env.GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY_HERE';
  }

  private getMockDirections(request: DirectionsRequest): NavigationRoute {
    const distance = this.calculateDistance(request.origin, request.destination);
    const duration = this.calculateEstimatedTravelTime(distance, request.mode);
    
    // Generate simple route coordinates (straight line with some interpolation)
    const coordinates: LocationCoordinates[] = [];
    const steps = 10;
    
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      coordinates.push({
        latitude: request.origin.latitude + (request.destination.latitude - request.origin.latitude) * ratio,
        longitude: request.origin.longitude + (request.destination.longitude - request.origin.longitude) * ratio,
      });
    }

    const instructions: NavigationInstruction[] = [
      {
        text: `Head ${this.getDirection(request.origin, request.destination)}`,
        distance: distance * 0.1,
        duration: duration * 0.1,
        coordinate: coordinates[1],
        maneuver: 'turn-slight-right',
      },
      {
        text: 'Continue straight',
        distance: distance * 0.8,
        duration: duration * 0.8,
        coordinate: coordinates[5],
        maneuver: 'straight',
      },
      {
        text: 'Arrive at destination',
        distance: distance * 0.1,
        duration: duration * 0.1,
        coordinate: request.destination,
        maneuver: 'arrive',
      },
    ];

    return {
      coordinates,
      distance,
      duration,
      instructions,
    };
  }

  private parseDirectionsResponse(data: any): NavigationRoute {
    const route = data.routes[0];
    const leg = route.legs[0];
    
    const coordinates: LocationCoordinates[] = [];
    const instructions: NavigationInstruction[] = [];
    
    // Parse polyline coordinates
    route.overview_polyline.points.forEach((point: any) => {
      coordinates.push({
        latitude: point.lat,
        longitude: point.lng,
      });
    });
    
    // Parse step instructions
    leg.steps.forEach((step: any) => {
      instructions.push({
        text: step.html_instructions.replace(/<[^>]*>/g, ''), // Strip HTML
        distance: step.distance.value,
        duration: step.duration.value,
        coordinate: {
          latitude: step.start_location.lat,
          longitude: step.start_location.lng,
        },
        maneuver: step.maneuver,
      });
    });

    return {
      coordinates,
      distance: leg.distance.value,
      duration: leg.duration.value,
      instructions,
    };
  }

  private getDirection(from: LocationCoordinates, to: LocationCoordinates): string {
    const bearing = Math.atan2(
      to.longitude - from.longitude,
      to.latitude - from.latitude
    ) * (180 / Math.PI);
    
    const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index < 0 ? index + 8 : index];
  }
}

export default new NavigationService();