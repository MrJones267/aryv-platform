/**
 * @fileoverview Route deviation detection - alerts passengers when driver strays from route
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface DeviationAlert {
  rideId: string;
  currentLocation: Coordinate;
  expectedRoute: Coordinate[];
  deviationDistance: number; // meters
  timestamp: string;
  severity: 'minor' | 'significant' | 'critical';
}

type DeviationCallback = (alert: DeviationAlert) => void;

class RouteDeviationService {
  private static instance: RouteDeviationService;
  private expectedRoute: Coordinate[] = [];
  private rideId: string | null = null;
  private isMonitoring: boolean = false;
  private callback: DeviationCallback | null = null;
  private consecutiveDeviations: number = 0;

  /** Thresholds in meters */
  private static MINOR_THRESHOLD = 500;
  private static SIGNIFICANT_THRESHOLD = 1500;
  private static CRITICAL_THRESHOLD = 3000;
  /** Number of consecutive deviations before alerting */
  private static ALERT_AFTER_COUNT = 3;

  static getInstance(): RouteDeviationService {
    if (!RouteDeviationService.instance) {
      RouteDeviationService.instance = new RouteDeviationService();
    }
    return RouteDeviationService.instance;
  }

  /**
   * Start monitoring a ride's route for deviations
   */
  startMonitoring(
    rideId: string,
    expectedRoute: Coordinate[],
    onDeviation: DeviationCallback,
  ): void {
    this.rideId = rideId;
    this.expectedRoute = expectedRoute;
    this.callback = onDeviation;
    this.isMonitoring = true;
    this.consecutiveDeviations = 0;
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    this.expectedRoute = [];
    this.rideId = null;
    this.callback = null;
    this.consecutiveDeviations = 0;
  }

  /**
   * Check a new location against the expected route.
   * Call this with each GPS update during the ride.
   */
  checkLocation(currentLocation: Coordinate): DeviationAlert | null {
    if (!this.isMonitoring || this.expectedRoute.length === 0 || !this.rideId) {
      return null;
    }

    const minDistance = this.getMinDistanceToRoute(currentLocation);

    if (minDistance < RouteDeviationService.MINOR_THRESHOLD) {
      // On route — reset counter
      this.consecutiveDeviations = 0;
      return null;
    }

    this.consecutiveDeviations++;

    // Only alert after sustained deviation (not a brief GPS glitch)
    if (this.consecutiveDeviations < RouteDeviationService.ALERT_AFTER_COUNT) {
      return null;
    }

    const severity = this.classifySeverity(minDistance);

    const alert: DeviationAlert = {
      rideId: this.rideId,
      currentLocation,
      expectedRoute: this.expectedRoute,
      deviationDistance: Math.round(minDistance),
      timestamp: new Date().toISOString(),
      severity,
    };

    if (this.callback) {
      this.callback(alert);
    }

    return alert;
  }

  /**
   * Get the minimum distance from a point to any segment of the route
   */
  private getMinDistanceToRoute(point: Coordinate): number {
    if (this.expectedRoute.length === 0) return 0;
    if (this.expectedRoute.length === 1) {
      return this.haversineDistance(point, this.expectedRoute[0]);
    }

    let minDist = Infinity;

    for (let i = 0; i < this.expectedRoute.length - 1; i++) {
      const dist = this.pointToSegmentDistance(
        point,
        this.expectedRoute[i],
        this.expectedRoute[i + 1],
      );
      if (dist < minDist) {
        minDist = dist;
      }
    }

    return minDist;
  }

  /**
   * Distance from a point to a line segment (in meters)
   */
  private pointToSegmentDistance(
    point: Coordinate,
    segStart: Coordinate,
    segEnd: Coordinate,
  ): number {
    const dStart = this.haversineDistance(point, segStart);
    const dEnd = this.haversineDistance(point, segEnd);
    const segLen = this.haversineDistance(segStart, segEnd);

    if (segLen === 0) return dStart;

    // Project point onto segment using dot product approximation
    const dx = segEnd.longitude - segStart.longitude;
    const dy = segEnd.latitude - segStart.latitude;
    const px = point.longitude - segStart.longitude;
    const py = point.latitude - segStart.latitude;

    let t = (px * dx + py * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));

    const closest: Coordinate = {
      latitude: segStart.latitude + t * dy,
      longitude: segStart.longitude + t * dx,
    };

    return this.haversineDistance(point, closest);
  }

  /**
   * Haversine distance between two coordinates in meters
   */
  private haversineDistance(a: Coordinate, b: Coordinate): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(b.latitude - a.latitude);
    const dLon = this.toRad(b.longitude - a.longitude);
    const lat1 = this.toRad(a.latitude);
    const lat2 = this.toRad(b.latitude);

    const s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));

    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private classifySeverity(distance: number): 'minor' | 'significant' | 'critical' {
    if (distance >= RouteDeviationService.CRITICAL_THRESHOLD) return 'critical';
    if (distance >= RouteDeviationService.SIGNIFICANT_THRESHOLD) return 'significant';
    return 'minor';
  }

  isActive(): boolean {
    return this.isMonitoring;
  }
}

export default RouteDeviationService;
