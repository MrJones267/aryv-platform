/**
 * @fileoverview Custom hook for performance optimization features
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { AppState, AppStateStatus, InteractionManager, View, Dimensions } from 'react-native';
import PerformanceMonitor from '../utils/performance/PerformanceMonitor';
import logger from '../services/LoggingService';

const log = logger.createLogger('usePerformanceOptimization');

export interface PerformanceHookOptions {
  enableMonitoring?: boolean;
  trackNavigation?: boolean;
  trackRenders?: boolean;
  logSlowOperations?: boolean;
  slowOperationThreshold?: number;
}

export function usePerformanceOptimization(
  componentName: string,
  options: PerformanceHookOptions = {}
) {
  const {
    enableMonitoring = true,
    trackNavigation = true,
    trackRenders = true,
    logSlowOperations = true,
    slowOperationThreshold = 16, // 16ms for 60fps
  } = options;

  const renderStartTime = useRef<number>(Date.now());
  const mountTime = useRef<number>(Date.now());
  const timingIds = useRef<Map<string, string>>(new Map());

  // Track component mount time
  useEffect(() => {
    if (!enableMonitoring) return;

    const mountDuration = Date.now() - mountTime.current;
    PerformanceMonitor.markTiming(
      `${componentName}_mount`,
      'render',
      mountDuration,
      { componentName, type: 'mount' }
    );

    if (logSlowOperations && mountDuration > slowOperationThreshold) {
      log.warn(`Slow component mount: ${componentName} took ${mountDuration}ms`);
    }

    return () => {
      PerformanceMonitor.markTiming(
        `${componentName}_unmount`,
        'render',
        undefined,
        { componentName, type: 'unmount' }
      );
    };
  }, [componentName, enableMonitoring, logSlowOperations, slowOperationThreshold]);

  // Start timing for an operation
  const startTiming = useCallback((operationName: string, type: 'navigation' | 'render' | 'api' | 'custom' = 'custom') => {
    if (!enableMonitoring) return '';

    const timingId = PerformanceMonitor.startTiming(`${componentName}_${operationName}`, type);
    timingIds.current.set(operationName, timingId);
    return timingId;
  }, [componentName, enableMonitoring]);

  // End timing for an operation
  const endTiming = useCallback((operationName: string, metadata?: Record<string, any>) => {
    if (!enableMonitoring) return;

    const timingId = timingIds.current.get(operationName);
    if (timingId) {
      PerformanceMonitor.endTiming(timingId, { componentName, ...metadata });
      timingIds.current.delete(operationName);
    }
  }, [componentName, enableMonitoring]);

  // Mark a single point in time
  const markTiming = useCallback((operationName: string, value?: number, metadata?: Record<string, any>) => {
    if (!enableMonitoring) return;

    PerformanceMonitor.markTiming(
      `${componentName}_${operationName}`,
      'custom',
      value,
      { componentName, ...metadata }
    );
  }, [componentName, enableMonitoring]);

  // Measure render performance
  const measureRender = useCallback(() => {
    if (!enableMonitoring || !trackRenders) return;

    const renderDuration = Date.now() - renderStartTime.current;
    
    PerformanceMonitor.markTiming(
      `${componentName}_render`,
      'render',
      renderDuration,
      { componentName, type: 'render' }
    );

    if (logSlowOperations && renderDuration > slowOperationThreshold) {
      log.warn(`Slow render: ${componentName} took ${renderDuration}ms`);
    }

    renderStartTime.current = Date.now();
  }, [componentName, enableMonitoring, trackRenders, logSlowOperations, slowOperationThreshold]);

  // Track render performance on each render
  useEffect(() => {
    measureRender();
  });

  return {
    startTiming,
    endTiming,
    markTiming,
    measureRender,
  };
}

// Hook for optimizing expensive computations
export function useOptimizedComputation<T>(
  computation: () => T,
  dependencies: any[],
  options: { skipOnBackgroundState?: boolean; useInteractionManager?: boolean } = {}
) {
  const { skipOnBackgroundState = true, useInteractionManager = true } = options;
  const appState = useRef(AppState.currentState);
  const computationRef = useRef<T | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      appState.current = nextAppState;
    });

    return () => subscription?.remove();
  }, []);

  return useMemo(() => {
    // Skip computation if app is in background
    if (skipOnBackgroundState && appState.current !== 'active') {
      return computationRef.current;
    }

    const performComputation = () => {
      const startTime = Date.now();
      const result = computation();
      const duration = Date.now() - startTime;

      // Log slow computations
      if (duration > 16) {
        log.warn(`Slow computation detected: ${duration}ms`);
      }

      PerformanceMonitor.markTiming('expensive_computation', 'custom', duration, {
        type: 'computation',
        duration,
      });

      computationRef.current = result;
      return result;
    };

    if (useInteractionManager) {
      // Defer computation until after interactions are complete
      InteractionManager.runAfterInteractions(() => {
        performComputation();
      });
      
      // Return cached result immediately
      return computationRef.current;
    }

    return performComputation();
  }, dependencies);
}

// Hook for debouncing expensive operations
export function useDebounced<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  dependencies: any[] = []
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay, ...dependencies]) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

// Hook for throttling operations
export function useThrottled<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  dependencies: any[] = []
): T {
  const lastRun = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    if (Date.now() - lastRun.current >= delay) {
      callbackRef.current(...args);
      lastRun.current = Date.now();
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        lastRun.current = Date.now();
      }, delay - (Date.now() - lastRun.current));
    }
  }, [delay, ...dependencies]) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

// Hook for lazy loading data
export function useLazyLoad<T>(
  loadFunction: () => Promise<T>,
  dependencies: any[],
  options: { immediate?: boolean; cacheKey?: string } = {}
) {
  const { immediate = false, cacheKey } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadedRef = useRef(false);
  const cacheRef = useRef<Map<string, T>>(new Map());

  const load = useCallback(async () => {
    if (loading) return;

    // Check cache first
    if (cacheKey && cacheRef.current.has(cacheKey)) {
      setData(cacheRef.current.get(cacheKey)!);
      return;
    }

    setLoading(true);
    setError(null);

    const timingId = PerformanceMonitor.startTiming('lazy_load', 'custom');

    try {
      const result = await loadFunction();
      setData(result);
      loadedRef.current = true;

      // Cache result
      if (cacheKey) {
        cacheRef.current.set(cacheKey, result);
      }

      PerformanceMonitor.endTiming(timingId, {
        success: true,
        cacheKey,
        cached: false,
      });
    } catch (err) {
      setError(err as Error);
      PerformanceMonitor.endTiming(timingId, {
        success: false,
        error: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }, [loadFunction, loading, cacheKey]);

  useEffect(() => {
    if (immediate && !loadedRef.current) {
      load();
    }
  }, [immediate, load]);

  const reload = useCallback(() => {
    loadedRef.current = false;
    if (cacheKey) {
      cacheRef.current.delete(cacheKey);
    }
    load();
  }, [load, cacheKey]);

  return {
    data,
    loading,
    error,
    load,
    reload,
    loaded: loadedRef.current,
  };
}

// Hook for managing component visibility for performance
export function useVisibilityOptimization(threshold = 0.1) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<View>(null);

  useEffect(() => {
    // Simple visibility detection - in a real app, use Intersection Observer
    const checkVisibility = () => {
      if (ref.current) {
        ref.current.measure((x, y, width, height, pageX, pageY) => {
          const screenHeight = Dimensions.get('window').height;
          const isInViewport = pageY < screenHeight && pageY + height > 0;
          setIsVisible(isInViewport);
        });
      }
    };

    const intervalId = setInterval(checkVisibility, 100);
    checkVisibility();

    return () => clearInterval(intervalId);
  }, [threshold]);

  return { ref, isVisible };
}