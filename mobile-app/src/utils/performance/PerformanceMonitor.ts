/**
 * @fileoverview Performance monitoring utility for tracking app performance
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

// Modern Performance API using built-in global performance or react-native-performance
let PerformanceObserver: any;
let PerformanceEntry: any;
let performanceAPI: any;

try {
  // Try react-native-performance first
  const perfModule = require('react-native-performance');
  PerformanceObserver = perfModule.PerformanceObserver;
  PerformanceEntry = perfModule.PerformanceEntry;
  performanceAPI = perfModule.default;
} catch (error) {
  // Fallback to global performance API (available in newer RN versions)
  try {
    if (typeof global.performance !== 'undefined') {
      performanceAPI = global.performance;
      // Use simple timing fallbacks
      PerformanceObserver = null;
      PerformanceEntry = null;
    } else {
      // Complete fallback using Date.now()
      performanceAPI = {
        now: () => Date.now(),
        mark: (name: string) => log.info(`Performance mark: ${name} at ${Date.now()}`),
        measure: (name: string, startMark?: string) => log.info(`Performance measure: ${name}`)
      };
      PerformanceObserver = null;
      PerformanceEntry = null;
    }
  } catch (fallbackError) {
    // Ultimate fallback
    performanceAPI = {
      now: () => Date.now(),
      mark: () => {},
      measure: () => {}
    };
    PerformanceObserver = null;
    PerformanceEntry = null;
  }
}
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../../services/LoggingService';

const log = logger.createLogger('PerformanceMonitor');

export interface PerformanceMetric {
  id: string;
  name: string;
  type: 'navigation' | 'render' | 'api' | 'bundle' | 'memory' | 'custom';
  startTime: number;
  endTime?: number;
  duration?: number;
  value?: number;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    averageNavigationTime: number;
    averageRenderTime: number;
    averageApiTime: number;
    slowOperations: PerformanceMetric[];
    memoryUsage: number;
    totalMetrics: number;
  };
  timeRange: {
    start: number;
    end: number;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: any[] = [];
  private isEnabled = true;
  private sessionStartTime = Date.now();
  private appStateSubscription: any = null;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private readonly MAX_METRICS = 1000;
  private readonly STORAGE_KEY = 'hitch_performance_metrics';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (!this.isEnabled) return;

    try {
      // Initialize performance observers
      this.setupNavigationObserver();
      this.setupRenderObserver();
      this.setupMemoryMonitoring();

      // Monitor app state changes
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));

      // Load previous session metrics
      this.loadStoredMetrics();

      log.info('PerformanceMonitor initialized');
    } catch (error) {
      log.error('Error initializing PerformanceMonitor:', error);
      this.isEnabled = false;
    }
  }

  private setupNavigationObserver(): void {
    if (!PerformanceObserver) {
      log.warn('Navigation observer not supported: PerformanceObserver not available');
      return;
    }

    try {
      const observer = new PerformanceObserver((list: any) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.entryType === 'navigation') {
            this.addMetric({
              name: entry.name,
              type: 'navigation',
              startTime: entry.startTime,
              endTime: entry.startTime + entry.duration,
              duration: entry.duration,
              metadata: {
                entryType: entry.entryType,
              },
            });
          }
        });
      });

      observer.observe({ entryTypes: ['navigation'] });
      this.observers.push(observer);
    } catch (error) {
      log.warn('Navigation observer not supported:', error);
    }
  }

  private setupRenderObserver(): void {
    if (!PerformanceObserver) {
      log.warn('Render observer not supported: PerformanceObserver not available');
      return;
    }

    try {
      const observer = new PerformanceObserver((list: any) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.entryType === 'measure' || entry.entryType === 'mark') {
            this.addMetric({
              name: entry.name,
              type: 'render',
              startTime: entry.startTime,
              duration: entry.duration,
              metadata: {
                entryType: entry.entryType,
              },
            });
          }
        });
      });

      observer.observe({ entryTypes: ['measure', 'mark'] });
      this.observers.push(observer);
    } catch (error) {
      log.warn('Render observer not supported:', error);
    }
  }

  private setupMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      this.recordMemoryUsage();
    }, 30000); // Every 30 seconds
  }

  private recordMemoryUsage(): void {
    try {
      // In React Native, memory monitoring is limited
      // This is a placeholder for when JS heap size API becomes available
      const memoryUsage = (global as any).performance?.memory?.usedJSHeapSize || 0;
      
      this.addMetric({
        name: 'memory_usage',
        type: 'memory',
        startTime: Date.now(),
        value: memoryUsage,
        metadata: {
          unit: 'bytes',
        },
      });
    } catch (error) {
      log.warn('Memory monitoring not available:', error);
    }
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'background') {
      // Save metrics when app goes to background
      this.saveMetricsToStorage();
    } else if (nextAppState === 'active') {
      // Clear old metrics and start fresh session
      this.startNewSession();
    }
  }

  private async loadStoredMetrics(): Promise<void> {
    try {
      const storedMetrics = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (storedMetrics) {
        const parsedMetrics: PerformanceMetric[] = JSON.parse(storedMetrics);
        // Only load recent metrics (last 24 hours)
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        this.metrics = parsedMetrics.filter(metric => metric.timestamp > oneDayAgo);
      }
    } catch (error) {
      log.error('Error loading stored metrics:', error);
    }
  }

  private async saveMetricsToStorage(): Promise<void> {
    try {
      // Only save last 500 metrics to avoid storage bloat
      const metricsToSave = this.metrics.slice(-500);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(metricsToSave));
    } catch (error) {
      log.error('Error saving metrics to storage:', error);
    }
  }

  private startNewSession(): void {
    this.sessionStartTime = Date.now();
    // Keep only recent metrics from current session
    const sessionStart = this.sessionStartTime - (60 * 60 * 1000); // Last hour
    this.metrics = this.metrics.filter(metric => metric.timestamp > sessionStart);
  }

  // Public methods
  startTiming(name: string, type: PerformanceMetric['type'] = 'custom'): string {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.addMetric({
      id,
      name,
      type,
      startTime: Date.now(),
    });

    return id;
  }

  endTiming(id: string, metadata?: Record<string, any>): void {
    const metricIndex = this.metrics.findIndex(m => m.id === id);
    if (metricIndex === -1) {
      log.warn(`Metric with id ${id} not found`);
      return;
    }

    const metric = this.metrics[metricIndex];
    const endTime = Date.now();
    const duration = endTime - metric.startTime;

    this.metrics[metricIndex] = {
      ...metric,
      endTime,
      duration,
      metadata: { ...metric.metadata, ...metadata },
    };
  }

  markTiming(name: string, type: PerformanceMetric['type'] = 'custom', value?: number, metadata?: Record<string, any>): void {
    this.addMetric({
      name,
      type,
      startTime: Date.now(),
      value,
      metadata,
    });
  }

  measureApiCall(url: string, method: string, startTime: number, endTime: number, statusCode?: number): void {
    this.addMetric({
      name: `api_${method.toLowerCase()}_${url.split('/').pop() || 'unknown'}`,
      type: 'api',
      startTime,
      endTime,
      duration: endTime - startTime,
      metadata: {
        url,
        method,
        statusCode,
      },
    });
  }

  measureBundleLoad(bundleName: string, size: number, loadTime: number): void {
    this.addMetric({
      name: `bundle_${bundleName}`,
      type: 'bundle',
      startTime: Date.now() - loadTime,
      endTime: Date.now(),
      duration: loadTime,
      value: size,
      metadata: {
        bundleName,
        size,
        unit: 'bytes',
      },
    });
  }

  private addMetric(metric: Partial<PerformanceMetric>): void {
    if (!this.isEnabled) return;

    const fullMetric: PerformanceMetric = {
      id: metric.id || `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: metric.name!,
      type: metric.type!,
      startTime: metric.startTime!,
      endTime: metric.endTime,
      duration: metric.duration,
      value: metric.value,
      metadata: metric.metadata,
      timestamp: Date.now(),
    };

    this.metrics.push(fullMetric);

    // Prevent memory bloat
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-Math.floor(this.MAX_METRICS * 0.8));
    }

    // Log slow operations
    if (fullMetric.duration && fullMetric.duration > 1000) {
      log.warn(`Slow operation detected: ${fullMetric.name} took ${fullMetric.duration}ms`);
    }
  }

  getMetrics(type?: PerformanceMetric['type'], limit?: number): PerformanceMetric[] {
    let filteredMetrics = type 
      ? this.metrics.filter(m => m.type === type)
      : this.metrics;

    if (limit) {
      filteredMetrics = filteredMetrics.slice(-limit);
    }

    return [...filteredMetrics];
  }

  generateReport(timeRange?: { start: number; end: number }): PerformanceReport {
    const start = timeRange?.start || this.sessionStartTime;
    const end = timeRange?.end || Date.now();
    
    const relevantMetrics = this.metrics.filter(
      m => m.timestamp >= start && m.timestamp <= end
    );

    const navigationMetrics = relevantMetrics.filter(m => m.type === 'navigation' && m.duration);
    const renderMetrics = relevantMetrics.filter(m => m.type === 'render' && m.duration);
    const apiMetrics = relevantMetrics.filter(m => m.type === 'api' && m.duration);
    const memoryMetrics = relevantMetrics.filter(m => m.type === 'memory' && m.value);

    const averageNavigationTime = navigationMetrics.length > 0
      ? navigationMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / navigationMetrics.length
      : 0;

    const averageRenderTime = renderMetrics.length > 0
      ? renderMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / renderMetrics.length
      : 0;

    const averageApiTime = apiMetrics.length > 0
      ? apiMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / apiMetrics.length
      : 0;

    const slowOperations = relevantMetrics.filter(m => m.duration && m.duration > 500);

    const latestMemoryUsage = memoryMetrics.length > 0
      ? memoryMetrics[memoryMetrics.length - 1].value || 0
      : 0;

    return {
      metrics: relevantMetrics,
      summary: {
        averageNavigationTime,
        averageRenderTime,
        averageApiTime,
        slowOperations,
        memoryUsage: latestMemoryUsage,
        totalMetrics: relevantMetrics.length,
      },
      timeRange: { start, end },
    };
  }

  clearMetrics(): void {
    this.metrics = [];
    AsyncStorage.removeItem(this.STORAGE_KEY);
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.cleanup();
    }
  }

  private cleanup(): void {
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        log.warn('Error disconnecting observer:', error);
      }
    });
    this.observers = [];

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  destroy(): void {
    this.saveMetricsToStorage();
    this.cleanup();
    this.metrics = [];
  }
}

export default new PerformanceMonitor();