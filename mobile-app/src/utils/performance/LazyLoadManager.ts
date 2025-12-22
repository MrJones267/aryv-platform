/**
 * @fileoverview Lazy loading manager for optimizing component and data loading
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React from 'react';
import { InteractionManager, Dimensions } from 'react-native';

export interface LazyLoadOptions {
  threshold?: number; // Distance from viewport to trigger loading
  rootMargin?: string; // CSS-like margin for intersection calculation
  delay?: number; // Delay before loading in milliseconds
  priority?: 'low' | 'normal' | 'high';
  preload?: boolean; // Whether to preload when idle
}

export interface LazyLoadEntry {
  id: string;
  element: any;
  options: LazyLoadOptions;
  callback: () => void | Promise<void>;
  loaded: boolean;
  loading: boolean;
  inViewport: boolean;
  timestamp: number;
}

class LazyLoadManager {
  private entries: Map<string, LazyLoadEntry> = new Map();
  private observer: any = null; // Placeholder for intersection observer
  private isInitialized = false;
  private screenDimensions = Dimensions.get('window');
  private loadQueue: LazyLoadEntry[] = [];
  private isProcessingQueue = false;
  private preloadQueue: LazyLoadEntry[] = [];

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      // Listen for dimension changes
      const subscription = Dimensions.addEventListener('change', ({ window }) => {
        this.screenDimensions = window;
        this.updateViewportCalculations();
      });

      // Start queue processing
      this.startQueueProcessing();

      // Setup idle preloading
      this.setupIdlePreloading();

      this.isInitialized = true;
      console.log('LazyLoadManager initialized');
    } catch (error) {
      console.error('Error initializing LazyLoadManager:', error);
    }
  }

  private updateViewportCalculations(): void {
    // Recalculate which elements are in viewport
    for (const entry of this.entries.values()) {
      if (!entry.loaded) {
        this.checkViewportIntersection(entry);
      }
    }
  }

  private checkViewportIntersection(entry: LazyLoadEntry): boolean {
    // Simplified viewport detection
    // In a real implementation, you'd use proper intersection observer
    const { threshold = 100 } = entry.options;
    
    // This is a placeholder - real implementation would measure actual element position
    const assumedInViewport = Math.random() > 0.5; // Placeholder logic
    
    if (assumedInViewport !== entry.inViewport) {
      entry.inViewport = assumedInViewport;
      
      if (assumedInViewport && !entry.loaded && !entry.loading) {
        this.queueForLoading(entry);
      }
    }

    return assumedInViewport;
  }

  private queueForLoading(entry: LazyLoadEntry): void {
    if (entry.loading || entry.loaded) return;

    // Add to appropriate queue based on priority
    if (entry.options.priority === 'high') {
      this.loadQueue.unshift(entry);
    } else {
      this.loadQueue.push(entry);
    }

    // Start processing if not already running
    if (!this.isProcessingQueue) {
      this.processLoadQueue();
    }
  }

  private async processLoadQueue(): Promise<void> {
    if (this.isProcessingQueue || this.loadQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.loadQueue.length > 0) {
      const entry = this.loadQueue.shift();
      if (!entry || entry.loaded || entry.loading) continue;

      try {
        await this.loadEntry(entry);
      } catch (error) {
        console.error('Error loading lazy entry:', error);
      }

      // Small delay between loads to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.isProcessingQueue = false;
  }

  private async loadEntry(entry: LazyLoadEntry): Promise<void> {
    if (entry.loaded || entry.loading) return;

    entry.loading = true;

    try {
      // Apply delay if specified
      if (entry.options.delay && entry.options.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, entry.options.delay));
      }

      // Execute the callback
      await Promise.resolve(entry.callback());
      
      entry.loaded = true;
      entry.loading = false;
      entry.timestamp = Date.now();

      console.log(`Lazy loaded: ${entry.id}`);
    } catch (error) {
      entry.loading = false;
      throw error;
    }
  }

  private startQueueProcessing(): void {
    // Process queue periodically
    setInterval(() => {
      if (!this.isProcessingQueue && this.loadQueue.length > 0) {
        this.processLoadQueue();
      }
    }, 100);
  }

  private setupIdlePreloading(): void {
    // Preload low-priority items when the app is idle
    const preloadWhenIdle = () => {
      InteractionManager.runAfterInteractions(() => {
        this.processPreloadQueue();
      });
    };

    // Run preloading every 5 seconds when idle
    setInterval(preloadWhenIdle, 5000);
  }

  private async processPreloadQueue(): Promise<void> {
    if (this.preloadQueue.length === 0) return;

    // Only preload if main queue is empty (app is idle)
    if (this.loadQueue.length === 0) {
      const entry = this.preloadQueue.shift();
      if (entry && !entry.loaded && !entry.loading) {
        try {
          await this.loadEntry(entry);
        } catch (error) {
          console.warn('Error during preload:', error);
        }
      }
    }
  }

  // Public methods
  register(
    id: string,
    callback: () => void | Promise<void>,
    options: LazyLoadOptions = {}
  ): () => void {
    const entry: LazyLoadEntry = {
      id,
      element: null, // Would be set by the component
      options: {
        threshold: 100,
        priority: 'normal',
        preload: false,
        ...options,
      },
      callback,
      loaded: false,
      loading: false,
      inViewport: false,
      timestamp: Date.now(),
    };

    this.entries.set(id, entry);

    // Add to preload queue if enabled
    if (entry.options.preload) {
      this.preloadQueue.push(entry);
    }

    // Immediately check if in viewport (for elements already visible)
    this.checkViewportIntersection(entry);

    // Return unregister function
    return () => {
      this.unregister(id);
    };
  }

  unregister(id: string): void {
    this.entries.delete(id);
    
    // Remove from queues
    this.loadQueue = this.loadQueue.filter(entry => entry.id !== id);
    this.preloadQueue = this.preloadQueue.filter(entry => entry.id !== id);
  }

  forceLoad(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) {
      return Promise.reject(new Error(`Entry with id ${id} not found`));
    }

    if (entry.loaded) {
      return Promise.resolve();
    }

    return this.loadEntry(entry);
  }

  preload(ids: string[]): Promise<void[]> {
    const promises = ids.map(id => {
      const entry = this.entries.get(id);
      if (entry && !entry.loaded && !entry.loading) {
        return this.loadEntry(entry);
      }
      return Promise.resolve();
    });

    return Promise.all(promises);
  }

  isLoaded(id: string): boolean {
    const entry = this.entries.get(id);
    return entry ? entry.loaded : false;
  }

  isLoading(id: string): boolean {
    const entry = this.entries.get(id);
    return entry ? entry.loading : false;
  }

  setViewportStatus(id: string, inViewport: boolean): void {
    const entry = this.entries.get(id);
    if (!entry) return;

    const wasInViewport = entry.inViewport;
    entry.inViewport = inViewport;

    // Queue for loading if just entered viewport
    if (inViewport && !wasInViewport && !entry.loaded && !entry.loading) {
      this.queueForLoading(entry);
    }
  }

  getStats(): {
    totalEntries: number;
    loadedEntries: number;
    loadingEntries: number;
    queueSize: number;
    preloadQueueSize: number;
  } {
    let loadedCount = 0;
    let loadingCount = 0;

    for (const entry of this.entries.values()) {
      if (entry.loaded) loadedCount++;
      if (entry.loading) loadingCount++;
    }

    return {
      totalEntries: this.entries.size,
      loadedEntries: loadedCount,
      loadingEntries: loadingCount,
      queueSize: this.loadQueue.length,
      preloadQueueSize: this.preloadQueue.length,
    };
  }

  clear(): void {
    this.entries.clear();
    this.loadQueue = [];
    this.preloadQueue = [];
  }

  destroy(): void {
    this.clear();
    this.isInitialized = false;
  }
}

// React hook for using lazy loading
export function useLazyLoad(
  callback: () => void | Promise<void>,
  options: LazyLoadOptions = {}
) {
  const [loaded, setLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const idRef = React.useRef(`lazy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  React.useEffect(() => {
    const id = idRef.current;
    
    const wrappedCallback = async () => {
      setLoading(true);
      try {
        await Promise.resolve(callback());
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    };

    const unregister = lazyLoadManager.register(id, wrappedCallback, options);

    return unregister;
  }, [callback]);

  const forceLoad = React.useCallback(() => {
    return lazyLoadManager.forceLoad(idRef.current);
  }, []);

  const setInViewport = React.useCallback((inViewport: boolean) => {
    lazyLoadManager.setViewportStatus(idRef.current, inViewport);
  }, []);

  return {
    loaded,
    loading,
    forceLoad,
    setInViewport,
  };
}

// Higher-order component for lazy loading
export function withLazyLoading<P extends object>(
  Component: React.ComponentType<P>,
  options: LazyLoadOptions = {}
) {
  return React.memo((props: P) => {
    const [shouldRender, setShouldRender] = React.useState(false);
    
    const { loaded, setInViewport } = useLazyLoad(() => {
      setShouldRender(true);
    }, options);

    // Placeholder while not loaded
    if (!shouldRender) {
      return React.createElement('div', { 
        style: { minHeight: 100 },
        ref: (element: any) => {
          if (element) {
            // Simplified viewport detection
            setInViewport(true);
          }
        }
      });
    }

    return React.createElement(Component, props);
  });
}

const lazyLoadManager = new LazyLoadManager();
export default lazyLoadManager;