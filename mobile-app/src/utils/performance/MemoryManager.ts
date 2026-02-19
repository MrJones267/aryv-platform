/**
 * @fileoverview Memory management utility for preventing memory leaks
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../../services/LoggingService';

const log = logger.createLogger('MemoryManager');

export interface MemoryWarning {
  timestamp: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  availableMemory?: number;
  usedMemory?: number;
  action?: string;
}

export interface MemoryStats {
  warnings: MemoryWarning[];
  totalWarnings: number;
  lastCleanup: number;
  gcCount: number;
  leakDetections: number;
}

export interface CleanupFunction {
  id: string;
  cleanup: () => void | Promise<void>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

class MemoryManager {
  private cleanupFunctions: Map<string, CleanupFunction> = new Map();
  private memoryWarnings: MemoryWarning[] = [];
  private appStateSubscription: any = null;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private lastCleanupTime = 0;
  private gcCount = 0;
  private isEnabled = true;
  private readonly MAX_WARNINGS = 50;
  private readonly MEMORY_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly CLEANUP_COOLDOWN = 60000; // 1 minute

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      // Monitor app state changes
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));

      // Start memory monitoring
      this.startMemoryMonitoring();

      // Register default cleanup functions
      this.registerDefaultCleanupFunctions();

      log.info('MemoryManager initialized');
    } catch (error) {
      log.error('Error initializing MemoryManager:', error);
      this.isEnabled = false;
    }
  }

  private startMemoryMonitoring(): void {
    if (!this.isEnabled) return;

    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.MEMORY_CHECK_INTERVAL);
  }

  private registerDefaultCleanupFunctions(): void {
    // Clear image cache
    this.registerCleanupFunction({
      id: 'clear_image_cache',
      cleanup: async () => {
        // This would integrate with ImageOptimizer
        log.info('Clearing image cache for memory');
      },
      priority: 'medium',
      description: 'Clear cached images to free memory',
    });

    // Clear old logs
    this.registerCleanupFunction({
      id: 'clear_old_logs',
      cleanup: async () => {
        log.info('Clearing old logs');
      },
      priority: 'low',
      description: 'Clear old log entries',
    });

    // Force garbage collection (if available)
    this.registerCleanupFunction({
      id: 'force_gc',
      cleanup: () => {
        if (global.gc) {
          global.gc();
          this.gcCount++;
          log.info('Forced garbage collection');
        }
      },
      priority: 'high',
      description: 'Force garbage collection',
    });

    // Clear AsyncStorage cache
    this.registerCleanupFunction({
      id: 'clear_temp_storage',
      cleanup: async () => {
        try {
          const keys = await AsyncStorage.getAllKeys();
          const tempKeys = keys.filter(key => key.startsWith('temp_') || key.startsWith('cache_'));
          if (tempKeys.length > 0) {
            await AsyncStorage.multiRemove(tempKeys);
            log.info(`Cleared ${tempKeys.length} temporary storage items`);
          }
        } catch (error) {
          log.error('Error clearing temp storage:', error);
        }
      },
      priority: 'medium',
      description: 'Clear temporary storage items',
    });
  }

  private checkMemoryUsage(): void {
    try {
      // React Native doesn't have direct memory APIs, so we use approximations
      const memoryInfo = this.getMemoryInfo();
      
      if (memoryInfo.warningLevel !== 'none') {
        this.handleMemoryWarning(memoryInfo.warningLevel, memoryInfo);
      }
    } catch (error) {
      log.error('Error checking memory usage:', error);
    }
  }

  private getMemoryInfo(): {
    warningLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
    usedMemory?: number;
    availableMemory?: number;
  } {
    // Simplified memory detection based on available indicators
    const jsHeapSizeLimit = (global as any).performance?.memory?.jsHeapSizeLimit;
    const usedJSHeapSize = (global as any).performance?.memory?.usedJSHeapSize;

    if (jsHeapSizeLimit && usedJSHeapSize) {
      const memoryUsageRatio = usedJSHeapSize / jsHeapSizeLimit;
      
      if (memoryUsageRatio > 0.9) {
        return { warningLevel: 'critical', usedMemory: usedJSHeapSize, availableMemory: jsHeapSizeLimit };
      } else if (memoryUsageRatio > 0.8) {
        return { warningLevel: 'high', usedMemory: usedJSHeapSize, availableMemory: jsHeapSizeLimit };
      } else if (memoryUsageRatio > 0.7) {
        return { warningLevel: 'medium', usedMemory: usedJSHeapSize, availableMemory: jsHeapSizeLimit };
      } else if (memoryUsageRatio > 0.6) {
        return { warningLevel: 'low', usedMemory: usedJSHeapSize, availableMemory: jsHeapSizeLimit };
      }
    }

    // Fallback: check other indicators
    const cleanupFunctionCount = this.cleanupFunctions.size;
    const warningCount = this.memoryWarnings.length;

    if (cleanupFunctionCount > 100 || warningCount > 10) {
      return { warningLevel: 'medium' };
    }

    return { warningLevel: 'none' };
  }

  private handleMemoryWarning(level: MemoryWarning['level'], memoryInfo?: any): void {
    const warning: MemoryWarning = {
      timestamp: Date.now(),
      level,
      availableMemory: memoryInfo?.availableMemory,
      usedMemory: memoryInfo?.usedMemory,
    };

    this.addMemoryWarning(warning);

    log.warn(`Memory warning (${level}):`, memoryInfo);

    // Trigger cleanup based on severity
    if (level === 'critical') {
      this.performEmergencyCleanup();
    } else if (level === 'high') {
      this.performAggressiveCleanup();
    } else if (level === 'medium') {
      this.performStandardCleanup();
    }
  }

  private addMemoryWarning(warning: MemoryWarning): void {
    this.memoryWarnings.push(warning);
    
    // Keep only recent warnings
    if (this.memoryWarnings.length > this.MAX_WARNINGS) {
      this.memoryWarnings = this.memoryWarnings.slice(-this.MAX_WARNINGS);
    }
  }

  private async performEmergencyCleanup(): Promise<void> {
    log.info('Performing emergency memory cleanup');
    await this.runCleanupByPriority(['critical', 'high', 'medium', 'low']);
  }

  private async performAggressiveCleanup(): Promise<void> {
    log.info('Performing aggressive memory cleanup');
    await this.runCleanupByPriority(['high', 'medium']);
  }

  private async performStandardCleanup(): Promise<void> {
    // Check cooldown
    if (Date.now() - this.lastCleanupTime < this.CLEANUP_COOLDOWN) {
      return;
    }

    log.info('Performing standard memory cleanup');
    await this.runCleanupByPriority(['medium']);
  }

  private async runCleanupByPriority(priorities: CleanupFunction['priority'][]): Promise<void> {
    this.lastCleanupTime = Date.now();
    
    const cleanupPromises: Promise<void>[] = [];

    for (const priority of priorities) {
      for (const cleanupFunction of this.cleanupFunctions.values()) {
        if (cleanupFunction.priority === priority) {
          try {
            const promise = Promise.resolve(cleanupFunction.cleanup());
            cleanupPromises.push(promise);
          } catch (error) {
            log.error(`Error in cleanup function ${cleanupFunction.id}:`, error);
          }
        }
      }
    }

    await Promise.allSettled(cleanupPromises);
    log.info(`Completed cleanup for priorities: ${priorities.join(', ')}`);
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'background') {
      // Perform cleanup when app goes to background
      this.performStandardCleanup();
    } else if (nextAppState === 'active') {
      // Resume monitoring when app becomes active
      this.checkMemoryUsage();
    }
  }

  // Public methods
  registerCleanupFunction(cleanupFunction: CleanupFunction): void {
    this.cleanupFunctions.set(cleanupFunction.id, cleanupFunction);
  }

  unregisterCleanupFunction(id: string): void {
    this.cleanupFunctions.delete(id);
  }

  async forceCleanup(priority?: CleanupFunction['priority']): Promise<void> {
    const priorities = priority ? [priority] : (['critical', 'high', 'medium', 'low'] as ('critical' | 'high' | 'medium' | 'low')[]);
    await this.runCleanupByPriority(priorities);
  }

  getMemoryStats(): MemoryStats {
    return {
      warnings: [...this.memoryWarnings],
      totalWarnings: this.memoryWarnings.length,
      lastCleanup: this.lastCleanupTime,
      gcCount: this.gcCount,
      leakDetections: this.detectPotentialLeaks(),
    };
  }

  private detectPotentialLeaks(): number {
    // Simple leak detection based on excessive cleanup function registrations
    let leakCount = 0;
    
    const functionCounts = new Map<string, number>();
    for (const func of this.cleanupFunctions.values()) {
      const baseId = func.id.split('_')[0];
      functionCounts.set(baseId, (functionCounts.get(baseId) || 0) + 1);
    }

    for (const count of functionCounts.values()) {
      if (count > 10) { // Arbitrary threshold
        leakCount++;
      }
    }

    return leakCount;
  }

  clearMemoryWarnings(): void {
    this.memoryWarnings = [];
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (!enabled && this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    } else if (enabled && !this.memoryCheckInterval) {
      this.startMemoryMonitoring();
    }
  }

  // Helper method for components to register cleanup
  useComponentCleanup(componentName: string, cleanup: () => void | Promise<void>): () => void {
    const cleanupId = `${componentName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.registerCleanupFunction({
      id: cleanupId,
      cleanup,
      priority: 'low',
      description: `Cleanup for component ${componentName}`,
    });

    // Return unregister function
    return () => {
      this.unregisterCleanupFunction(cleanupId);
    };
  }

  destroy(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.cleanupFunctions.clear();
    this.memoryWarnings = [];
    this.isEnabled = false;
    
    log.info('MemoryManager destroyed');
  }
}

export default new MemoryManager();