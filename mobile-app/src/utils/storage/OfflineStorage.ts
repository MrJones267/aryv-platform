/**
 * @fileoverview Offline storage utility for caching data locally
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheMetadata {
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  version: string;
}

export interface CachedData<T> {
  data: T;
  metadata: CacheMetadata;
}

export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class OfflineStorage {
  private readonly CACHE_PREFIX = 'hitch_cache_';
  private readonly OFFLINE_ACTIONS_KEY = 'hitch_offline_actions';
  private readonly SYNC_QUEUE_KEY = 'hitch_sync_queue';
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

  // Cache management
  async setCache<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const cacheKey = this.CACHE_PREFIX + key;
      const cachedData: CachedData<T> = {
        data,
        metadata: {
          timestamp: Date.now(),
          ttl,
          version: '1.0.0',
        },
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedData));
      await this.cleanupExpiredCache();
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }

  async getCache<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = this.CACHE_PREFIX + key;
      const cachedItem = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedItem) {
        return null;
      }

      const cachedData: CachedData<T> = JSON.parse(cachedItem);
      const now = Date.now();
      
      // Check if cache is expired
      if (now - cachedData.metadata.timestamp > cachedData.metadata.ttl) {
        await this.removeCache(key);
        return null;
      }

      return cachedData.data;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  }

  async removeCache(key: string): Promise<void> {
    try {
      const cacheKey = this.CACHE_PREFIX + key;
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Error removing cache:', error);
    }
  }

  async isCacheValid(key: string): Promise<boolean> {
    try {
      const cacheKey = this.CACHE_PREFIX + key;
      const cachedItem = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedItem) {
        return false;
      }

      const cachedData: CachedData<any> = JSON.parse(cachedItem);
      const now = Date.now();
      
      return now - cachedData.metadata.timestamp <= cachedData.metadata.ttl;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  }

  async getCacheSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      let totalSize = 0;
      for (const key of cacheKeys) {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          totalSize += item.length;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('Error calculating cache size:', error);
      return 0;
    }
  }

  async cleanupExpiredCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      const now = Date.now();

      for (const key of cacheKeys) {
        try {
          const item = await AsyncStorage.getItem(key);
          if (item) {
            const cachedData: CachedData<any> = JSON.parse(item);
            if (now - cachedData.metadata.timestamp > cachedData.metadata.ttl) {
              await AsyncStorage.removeItem(key);
            }
          }
        } catch (error) {
          // Remove corrupted cache items
          await AsyncStorage.removeItem(key);
        }
      }

      // Check if cache size exceeds limit
      const cacheSize = await this.getCacheSize();
      if (cacheSize > this.MAX_CACHE_SIZE) {
        await this.evictOldestCache();
      }
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }

  async evictOldestCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      const cacheItems: Array<{ key: string; timestamp: number }> = [];
      
      for (const key of cacheKeys) {
        try {
          const item = await AsyncStorage.getItem(key);
          if (item) {
            const cachedData: CachedData<any> = JSON.parse(item);
            cacheItems.push({ key, timestamp: cachedData.metadata.timestamp });
          }
        } catch (error) {
          // Remove corrupted items
          await AsyncStorage.removeItem(key);
        }
      }

      // Sort by timestamp and remove oldest 25%
      cacheItems.sort((a, b) => a.timestamp - b.timestamp);
      const itemsToRemove = Math.ceil(cacheItems.length * 0.25);
      
      for (let i = 0; i < itemsToRemove; i++) {
        await AsyncStorage.removeItem(cacheItems[i].key);
      }
    } catch (error) {
      console.error('Error evicting oldest cache:', error);
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }

  // Offline actions queue
  async addOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    try {
      const offlineAction: OfflineAction = {
        ...action,
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
      };

      const existingActions = await this.getOfflineActions();
      const updatedActions = [...existingActions, offlineAction];
      
      await AsyncStorage.setItem(this.OFFLINE_ACTIONS_KEY, JSON.stringify(updatedActions));
    } catch (error) {
      console.error('Error adding offline action:', error);
    }
  }

  async getOfflineActions(): Promise<OfflineAction[]> {
    try {
      const actionsJson = await AsyncStorage.getItem(this.OFFLINE_ACTIONS_KEY);
      return actionsJson ? JSON.parse(actionsJson) : [];
    } catch (error) {
      console.error('Error getting offline actions:', error);
      return [];
    }
  }

  async removeOfflineAction(actionId: string): Promise<void> {
    try {
      const existingActions = await this.getOfflineActions();
      const filteredActions = existingActions.filter(action => action.id !== actionId);
      
      await AsyncStorage.setItem(this.OFFLINE_ACTIONS_KEY, JSON.stringify(filteredActions));
    } catch (error) {
      console.error('Error removing offline action:', error);
    }
  }

  async updateOfflineActionRetryCount(actionId: string): Promise<void> {
    try {
      const existingActions = await this.getOfflineActions();
      const updatedActions = existingActions.map(action =>
        action.id === actionId
          ? { ...action, retryCount: action.retryCount + 1 }
          : action
      );
      
      await AsyncStorage.setItem(this.OFFLINE_ACTIONS_KEY, JSON.stringify(updatedActions));
    } catch (error) {
      console.error('Error updating offline action retry count:', error);
    }
  }

  async clearOfflineActions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.OFFLINE_ACTIONS_KEY);
    } catch (error) {
      console.error('Error clearing offline actions:', error);
    }
  }

  // Sync queue for data that needs to be uploaded when online
  async addToSyncQueue(data: any, endpoint: string, method: 'POST' | 'PUT' | 'DELETE' = 'POST'): Promise<void> {
    try {
      const syncItem = {
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        data,
        endpoint,
        method,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
      };

      const existingQueue = await this.getSyncQueue();
      const updatedQueue = [...existingQueue, syncItem];
      
      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(updatedQueue));
    } catch (error) {
      console.error('Error adding to sync queue:', error);
    }
  }

  async getSyncQueue(): Promise<any[]> {
    try {
      const queueJson = await AsyncStorage.getItem(this.SYNC_QUEUE_KEY);
      return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
      console.error('Error getting sync queue:', error);
      return [];
    }
  }

  async removeFromSyncQueue(itemId: string): Promise<void> {
    try {
      const existingQueue = await this.getSyncQueue();
      const filteredQueue = existingQueue.filter(item => item.id !== itemId);
      
      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(filteredQueue));
    } catch (error) {
      console.error('Error removing from sync queue:', error);
    }
  }

  async clearSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.SYNC_QUEUE_KEY);
    } catch (error) {
      console.error('Error clearing sync queue:', error);
    }
  }

  // Storage stats
  async getStorageStats(): Promise<{
    cacheSize: number;
    cacheCount: number;
    offlineActionsCount: number;
    syncQueueCount: number;
  }> {
    try {
      const [cacheSize, offlineActions, syncQueue] = await Promise.all([
        this.getCacheSize(),
        this.getOfflineActions(),
        this.getSyncQueue(),
      ]);

      const keys = await AsyncStorage.getAllKeys();
      const cacheCount = keys.filter(key => key.startsWith(this.CACHE_PREFIX)).length;

      return {
        cacheSize,
        cacheCount,
        offlineActionsCount: offlineActions.length,
        syncQueueCount: syncQueue.length,
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        cacheSize: 0,
        cacheCount: 0,
        offlineActionsCount: 0,
        syncQueueCount: 0,
      };
    }
  }
}

export default new OfflineStorage();