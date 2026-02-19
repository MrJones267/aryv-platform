/**
 * @fileoverview Network connectivity manager for offline handling
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import logger from '../../services/LoggingService';

const log = logger.createLogger('NetworkManager');

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  connectionQuality: 'poor' | 'fair' | 'good' | 'excellent' | 'unknown';
}

export interface NetworkListener {
  id: string;
  callback: (state: NetworkState) => void;
}

class NetworkManager {
  private listeners: NetworkListener[] = [];
  private currentState: NetworkState = {
    isConnected: false,
    isInternetReachable: false,
    type: 'unknown',
    connectionQuality: 'unknown',
  };
  private unsubscribeNetInfo: (() => void) | null = null;
  private appStateSubscription: any = null;
  private connectionHistory: Array<{ timestamp: number; isConnected: boolean }> = [];
  private readonly MAX_HISTORY_SIZE = 100;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Subscribe to network state changes
    this.unsubscribeNetInfo = NetInfo.addEventListener(this.handleNetworkStateChange.bind(this));

    // Subscribe to app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));

    // Get initial network state
    this.refreshNetworkState();
  }

  private handleNetworkStateChange(state: NetInfoState): void {
    const networkState: NetworkState = {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type: state.type,
      connectionQuality: this.determineConnectionQuality(state),
    };

    const wasConnected = this.currentState.isConnected;
    const isNowConnected = networkState.isConnected;

    this.currentState = networkState;
    this.addToConnectionHistory(isNowConnected);

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener.callback(networkState);
      } catch (error) {
        log.error('Error in network listener callback:', error);
      }
    });

    // Log significant network changes
    if (wasConnected !== isNowConnected) {
      log.info(`Network state changed: ${isNowConnected ? 'Connected' : 'Disconnected'}`);
    }
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active') {
      // Refresh network state when app becomes active
      this.refreshNetworkState();
    }
  }

  private determineConnectionQuality(state: NetInfoState): NetworkState['connectionQuality'] {
    if (!state.isConnected) {
      return 'unknown';
    }

    // For cellular connections, use the effective connection type
    if (state.type === 'cellular' && state.details) {
      const cellularGeneration = (state.details as any).cellularGeneration;
      switch (cellularGeneration) {
        case '2g':
          return 'poor';
        case '3g':
          return 'fair';
        case '4g':
        case '5g':
          return 'good';
        default:
          return 'fair';
      }
    }

    // For WiFi connections, assume good quality
    if (state.type === 'wifi') {
      return 'excellent';
    }

    return 'unknown';
  }

  private addToConnectionHistory(isConnected: boolean): void {
    this.connectionHistory.push({
      timestamp: Date.now(),
      isConnected,
    });

    // Keep history size manageable
    if (this.connectionHistory.length > this.MAX_HISTORY_SIZE) {
      this.connectionHistory = this.connectionHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  async refreshNetworkState(): Promise<NetworkState> {
    try {
      const state = await NetInfo.fetch();
      this.handleNetworkStateChange(state);
      return this.currentState;
    } catch (error) {
      log.error('Error fetching network state:', error);
      return this.currentState;
    }
  }

  getCurrentState(): NetworkState {
    return { ...this.currentState };
  }

  isConnected(): boolean {
    return this.currentState.isConnected && this.currentState.isInternetReachable;
  }

  isOffline(): boolean {
    return !this.isConnected();
  }

  getConnectionType(): string {
    return this.currentState.type;
  }

  getConnectionQuality(): NetworkState['connectionQuality'] {
    return this.currentState.connectionQuality;
  }

  addListener(callback: (state: NetworkState) => void): string {
    const id = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.listeners.push({ id, callback });
    
    // Immediately call with current state
    try {
      callback(this.currentState);
    } catch (error) {
      log.error('Error in initial network listener callback:', error);
    }
    
    return id;
  }

  removeListener(id: string): void {
    this.listeners = this.listeners.filter(listener => listener.id !== id);
  }

  removeAllListeners(): void {
    this.listeners = [];
  }

  // Connection stability analysis
  getConnectionStability(): {
    isStable: boolean;
    disconnectionCount: number;
    averageConnectionDuration: number;
    lastDisconnection?: number;
  } {
    const now = Date.now();
    const last24Hours = now - (24 * 60 * 60 * 1000);
    
    // Filter history to last 24 hours
    const recentHistory = this.connectionHistory.filter(
      entry => entry.timestamp >= last24Hours
    );

    if (recentHistory.length === 0) {
      return {
        isStable: true,
        disconnectionCount: 0,
        averageConnectionDuration: 0,
      };
    }

    let disconnectionCount = 0;
    let lastDisconnection: number | undefined;
    const connectionDurations: number[] = [];
    let currentConnectionStart: number | null = null;

    for (let i = 0; i < recentHistory.length; i++) {
      const entry = recentHistory[i];
      
      if (entry.isConnected && currentConnectionStart === null) {
        currentConnectionStart = entry.timestamp;
      } else if (!entry.isConnected && currentConnectionStart !== null) {
        connectionDurations.push(entry.timestamp - currentConnectionStart);
        currentConnectionStart = null;
        disconnectionCount++;
        lastDisconnection = entry.timestamp;
      }
    }

    // If currently connected, add current session duration
    if (currentConnectionStart !== null && this.currentState.isConnected) {
      connectionDurations.push(now - currentConnectionStart);
    }

    const averageConnectionDuration = connectionDurations.length > 0
      ? connectionDurations.reduce((sum, duration) => sum + duration, 0) / connectionDurations.length
      : 0;

    // Consider connection stable if less than 3 disconnections in 24 hours
    // and average connection duration is more than 1 hour
    const isStable = disconnectionCount < 3 && averageConnectionDuration > (60 * 60 * 1000);

    return {
      isStable,
      disconnectionCount,
      averageConnectionDuration,
      lastDisconnection,
    };
  }

  // Network request helper with retry logic
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    backoffMultiplier: number = 1.5
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = 1000; // Start with 1 second delay

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check if we're online before attempting
        if (!this.isConnected()) {
          throw new Error('No internet connection');
        }

        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if it's the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  // Wait for connection
  async waitForConnection(timeout: number = 30000): Promise<boolean> {
    if (this.isConnected()) {
      return true;
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.removeListener(listenerId);
        resolve(false);
      }, timeout);

      const listenerId = this.addListener((state) => {
        if (state.isConnected && state.isInternetReachable) {
          clearTimeout(timeoutId);
          this.removeListener(listenerId);
          resolve(true);
        }
      });
    });
  }

  // Get network statistics
  getNetworkStats(): {
    currentState: NetworkState;
    connectionHistory: Array<{ timestamp: number; isConnected: boolean }>;
    stability: ReturnType<NetworkManager['getConnectionStability']>;
  } {
    return {
      currentState: this.getCurrentState(),
      connectionHistory: [...this.connectionHistory],
      stability: this.getConnectionStability(),
    };
  }

  // Cleanup
  destroy(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.removeAllListeners();
    this.connectionHistory = [];
  }
}

export default new NetworkManager();