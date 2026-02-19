/**
 * @fileoverview Offline cache and action queue for resilient app behavior
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetworkManager from '../utils/network/NetworkManager';
import logger from './LoggingService';

const log = logger.createLogger('OfflineCacheService');

export interface PendingAction {
  id: string;
  type: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: unknown;
  createdAt: string;
  retryCount: number;
}

export interface CachedData {
  key: string;
  data: unknown;
  cachedAt: string;
  expiresAt: string;
}

const CACHE_PREFIX = '@aryv_cache_';
const PENDING_ACTIONS_KEY = '@aryv_pending_actions';
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

class OfflineCacheService {
  private static instance: OfflineCacheService;
  private isSyncing = false;
  private networkListenerId: string | null = null;

  static getInstance(): OfflineCacheService {
    if (!OfflineCacheService.instance) {
      OfflineCacheService.instance = new OfflineCacheService();
    }
    return OfflineCacheService.instance;
  }

  /**
   * Initialize offline mode — listen for reconnection to flush pending actions
   */
  initialize(): void {
    if (this.networkListenerId) return;

    this.networkListenerId = NetworkManager.addListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        this.flushPendingActions();
      }
    });
  }

  /**
   * Cache data with a TTL
   */
  async cacheData(key: string, data: unknown, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    try {
      const cached: CachedData = {
        key,
        data,
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      };
      await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cached));
    } catch (error) {
      log.warn('Failed to cache data', { error: String(error) });
    }
  }

  /**
   * Retrieve cached data (returns null if expired or not found)
   */
  async getCachedData<T = any>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;

      const cached: CachedData = JSON.parse(raw);
      if (new Date(cached.expiresAt) < new Date()) {
        // Expired — but still return if offline (stale is better than nothing)
        if (NetworkManager.isConnected()) {
          await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
          return null;
        }
      }
      return cached.data as T;
    } catch {
      return null;
    }
  }

  /**
   * Cache user's critical data for offline access
   */
  async cacheUserEssentials(data: {
    profile?: unknown;
    recentRides?: unknown[];
    contacts?: unknown[];
    receipts?: unknown[];
  }): Promise<void> {
    const oneHour = 60 * 60 * 1000;
    const promises: Promise<void>[] = [];

    if (data.profile) {
      promises.push(this.cacheData('user_profile', data.profile, oneHour * 24));
    }
    if (data.recentRides) {
      promises.push(this.cacheData('recent_rides', data.recentRides, oneHour));
    }
    if (data.contacts) {
      promises.push(this.cacheData('emergency_contacts', data.contacts, oneHour * 24));
    }
    if (data.receipts) {
      promises.push(this.cacheData('receipts', data.receipts, oneHour * 24));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Queue an action to be retried when connectivity returns
   */
  async queueAction(action: Omit<PendingAction, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
    try {
      const pending = await this.getPendingActions();
      pending.push({
        ...action,
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
      // Keep max 50 pending actions
      await AsyncStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(pending.slice(-50)));
    } catch (error) {
      log.warn('Failed to queue action', { error: String(error) });
    }
  }

  /**
   * Get all pending actions
   */
  async getPendingActions(): Promise<PendingAction[]> {
    try {
      const raw = await AsyncStorage.getItem(PENDING_ACTIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Flush pending actions when back online
   */
  async flushPendingActions(): Promise<void> {
    if (this.isSyncing || !NetworkManager.isConnected()) return;

    this.isSyncing = true;
    try {
      const pending = await this.getPendingActions();
      if (pending.length === 0) return;

      const remaining: PendingAction[] = [];

      for (const action of pending) {
        try {
          const token = await AsyncStorage.getItem('@aryv_auth_token')
            || await AsyncStorage.getItem('accessToken');

          const response = await fetch(action.endpoint, {
            method: action.method,
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: action.body ? JSON.stringify(action.body) : undefined,
          });

          if (!response.ok && action.retryCount < 3) {
            remaining.push({ ...action, retryCount: action.retryCount + 1 });
          }
          // If ok or max retries exceeded, drop the action
        } catch {
          if (action.retryCount < 3) {
            remaining.push({ ...action, retryCount: action.retryCount + 1 });
          }
        }
      }

      await AsyncStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(remaining));
    } catch (error) {
      log.warn('Flush failed', { error: String(error) });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get pending action count
   */
  async getPendingCount(): Promise<number> {
    const pending = await this.getPendingActions();
    return pending.length;
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      log.warn('Failed to clear cache', { error: String(error) });
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.networkListenerId) {
      NetworkManager.removeListener(this.networkListenerId);
      this.networkListenerId = null;
    }
  }
}

export default OfflineCacheService;
