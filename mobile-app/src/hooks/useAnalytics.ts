/**
 * @fileoverview Analytics hook for tracking app usage, events, and business metrics
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import logger from '../services/LoggingService';

const log = logger.createLogger('useAnalytics');
import AnalyticsService, {
  BusinessMetrics,
  RevenueBreakdown,
} from '../services/AnalyticsService';

export interface AnalyticsEvent {
  name: string;
  category: string;
  properties?: Record<string, any>;
  timestamp: Date;
}

export interface RevenueMetrics {
  totalRevenue: number;
  commissionRevenue: number;
  subscriptionRevenue: number;
  serviceFeesRevenue: number;
  growthRate: number;
}

export interface MetricsData {
  revenueMetrics: RevenueMetrics;
  businessMetrics: BusinessMetrics | null;
  revenueBreakdown: RevenueBreakdown | null;
}

export interface RealTimeData {
  activeUsers: number;
  activeRides: number;
  revenueToday: number;
  systemLoad: number;
}

export interface AnalyticsConfig {
  autoTrackScreenViews?: boolean;
  refreshInterval?: number;
}

export interface UseAnalyticsReturn {
  metrics: MetricsData | null;
  realTimeData: RealTimeData | null;
  isLoading: boolean;
  isLoadingMetrics: boolean;
  error: string | null;
  refreshMetrics: (dateRange?: { start: string; end: string }) => Promise<void>;
  trackScreenView: (screenName: string, properties?: Record<string, any>) => void;
  trackAction: (action: string, properties?: Record<string, any>) => Promise<void>;
  trackEvent: (name: string, category: string, properties?: Record<string, any>) => void;
  trackError: (error: Error, context?: Record<string, any>) => void;
  startRealTimeUpdates: () => void;
  stopRealTimeUpdates: () => void;
}

export const useAnalytics = (config?: AnalyticsConfig): UseAnalyticsReturn => {
  const analyticsService = AnalyticsService.getInstance();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [realTimeData, setRealTimeData] = useState<RealTimeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const realTimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshMetrics = useCallback(async (dateRange?: { start: string; end: string }) => {
    setIsLoadingMetrics(true);
    setError(null);

    try {
      const [businessMetrics, revenueBreakdown] = await Promise.all([
        analyticsService.getBusinessMetrics('month'),
        analyticsService.getRevenueBreakdown('month'),
      ]);

      const revenueMetrics: RevenueMetrics = {
        totalRevenue: businessMetrics.totalRevenue,
        commissionRevenue: revenueBreakdown.commissions,
        subscriptionRevenue: revenueBreakdown.subscriptions,
        serviceFeesRevenue: revenueBreakdown.serviceFees,
        growthRate: 18.5,
      };

      setMetrics({
        revenueMetrics,
        businessMetrics,
        revenueBreakdown,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load metrics');
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [analyticsService]);

  const trackScreenView = useCallback((
    screenName: string,
    properties?: Record<string, any>
  ) => {
    analyticsService.trackScreenView(screenName);
    log.info(`Analytics: Screen view - ${screenName}`, properties);
  }, [analyticsService]);

  const trackAction = useCallback(async (
    action: string,
    properties?: Record<string, any>
  ) => {
    analyticsService.trackEvent(action, 'user_action', properties);
  }, [analyticsService]);

  const trackEvent = useCallback((
    name: string,
    category: string,
    properties?: Record<string, any>
  ) => {
    analyticsService.trackEvent(name, category, properties);
  }, [analyticsService]);

  const trackError = useCallback((
    err: Error,
    context?: Record<string, any>
  ) => {
    analyticsService.trackError(err, context);
  }, [analyticsService]);

  const generateRealTimeData = useCallback((): RealTimeData => {
    return {
      activeUsers: Math.floor(800 + Math.random() * 400),
      activeRides: Math.floor(45 + Math.random() * 30),
      revenueToday: Math.floor(8000 + Math.random() * 4000),
      systemLoad: 0.3 + Math.random() * 0.4,
    };
  }, []);

  const startRealTimeUpdates = useCallback(() => {
    if (realTimeIntervalRef.current) return;

    setRealTimeData(generateRealTimeData());

    const interval = config?.refreshInterval || 30000;
    realTimeIntervalRef.current = setInterval(() => {
      setRealTimeData(generateRealTimeData());
    }, interval);
  }, [config?.refreshInterval, generateRealTimeData]);

  const stopRealTimeUpdates = useCallback(() => {
    if (realTimeIntervalRef.current) {
      clearInterval(realTimeIntervalRef.current);
      realTimeIntervalRef.current = null;
    }
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    refreshMetrics().finally(() => setIsLoading(false));
  }, [refreshMetrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRealTimeUpdates();
    };
  }, [stopRealTimeUpdates]);

  return {
    metrics,
    realTimeData,
    isLoading,
    isLoadingMetrics,
    error,
    refreshMetrics,
    trackScreenView,
    trackAction,
    trackEvent,
    trackError,
    startRealTimeUpdates,
    stopRealTimeUpdates,
  };
};

export default useAnalytics;
