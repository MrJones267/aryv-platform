/**
 * @fileoverview Hook for offline mode detection and UI state
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import { useState, useEffect, useCallback } from 'react';
import NetworkManager, { NetworkState } from '../utils/network/NetworkManager';
import OfflineCacheService from '../services/OfflineCacheService';

interface OfflineModeState {
  isOffline: boolean;
  connectionQuality: NetworkState['connectionQuality'];
  pendingActions: number;
  wasOffline: boolean;
}

export function useOfflineMode() {
  const [state, setState] = useState<OfflineModeState>({
    isOffline: !NetworkManager.isConnected(),
    connectionQuality: NetworkManager.getConnectionQuality(),
    pendingActions: 0,
    wasOffline: false,
  });

  useEffect(() => {
    const cache = OfflineCacheService.getInstance();
    cache.initialize();

    // Load initial pending count
    cache.getPendingCount().then((count) => {
      setState((prev) => ({ ...prev, pendingActions: count }));
    });

    const listenerId = NetworkManager.addListener((networkState) => {
      setState((prev) => {
        const isOffline = !networkState.isConnected || !networkState.isInternetReachable;
        return {
          isOffline,
          connectionQuality: networkState.connectionQuality,
          pendingActions: prev.pendingActions,
          // Track if we were recently offline (for "Back online" toast)
          wasOffline: prev.isOffline && !isOffline ? true : !isOffline ? false : prev.wasOffline,
        };
      });
    });

    return () => {
      NetworkManager.removeListener(listenerId);
    };
  }, []);

  const cacheData = useCallback(async (key: string, data: any, ttlMs?: number) => {
    const cache = OfflineCacheService.getInstance();
    await cache.cacheData(key, data, ttlMs);
  }, []);

  const getCachedData = useCallback(async <T = any>(key: string): Promise<T | null> => {
    const cache = OfflineCacheService.getInstance();
    return cache.getCachedData<T>(key);
  }, []);

  const queueAction = useCallback(async (
    type: string,
    endpoint: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: any,
  ) => {
    const cache = OfflineCacheService.getInstance();
    await cache.queueAction({ type, endpoint, method, body });
    const count = await cache.getPendingCount();
    setState((prev) => ({ ...prev, pendingActions: count }));
  }, []);

  return {
    ...state,
    cacheData,
    getCachedData,
    queueAction,
  };
}

export default useOfflineMode;
