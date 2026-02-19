/**
 * @fileoverview Sync manager for handling offline data synchronization
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import OfflineStorage, { OfflineAction } from '../storage/OfflineStorage';
import NetworkManager, { NetworkState } from '../network/NetworkManager';
import baseApi from '../../services/api/baseApi';
import logger from '../../services/LoggingService';

const log = logger.createLogger('SyncManager');

export interface SyncItem {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  data?: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  entityType: string; // e.g., 'message', 'booking', 'location'
  entityId?: string;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ item: SyncItem; error: string }>;
}

export interface SyncListener {
  id: string;
  callback: (result: SyncResult) => void;
}

class SyncManager {
  private isInitialized = false;
  private isSyncing = false;
  private syncListeners: SyncListener[] = [];
  private networkListenerId: string | null = null;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private readonly PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Listen for network changes
      this.networkListenerId = NetworkManager.addListener(this.handleNetworkChange.bind(this));

      // Start periodic sync if connected
      if (NetworkManager.isConnected()) {
        this.startPeriodicSync();
      }

      // Initial sync if online
      await this.syncWhenReady();

      this.isInitialized = true;
      log.info('SyncManager initialized');
    } catch (error) {
      log.error('Error initializing SyncManager:', error);
    }
  }

  private handleNetworkChange(networkState: NetworkState): void {
    if (networkState.isConnected && networkState.isInternetReachable) {
      log.info('Network connected - starting sync');
      this.startPeriodicSync();
      this.syncWhenReady();
    } else {
      log.info('Network disconnected - stopping periodic sync');
      this.stopPeriodicSync();
    }
  }

  private startPeriodicSync(): void {
    if (this.syncIntervalId) return;

    this.syncIntervalId = setInterval(() => {
      if (NetworkManager.isConnected() && !this.isSyncing) {
        this.syncWhenReady();
      }
    }, this.SYNC_INTERVAL);
  }

  private stopPeriodicSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  async addToQueue(item: Omit<SyncItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    try {
      const syncItem: SyncItem = {
        ...item,
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
      };

      // Store in offline storage
      await OfflineStorage.addToSyncQueue(syncItem, syncItem.endpoint, syncItem.method as any);

      // If online, try immediate sync for critical items
      if (NetworkManager.isConnected() && syncItem.priority === 'critical') {
        this.syncWhenReady();
      }

      log.info(`Added ${syncItem.entityType} to sync queue with ${syncItem.priority} priority`);
    } catch (error) {
      log.error('Error adding item to sync queue:', error);
    }
  }

  async syncWhenReady(): Promise<SyncResult> {
    if (this.isSyncing) {
      log.info('Sync already in progress, skipping');
      return {
        success: true,
        syncedCount: 0,
        failedCount: 0,
        errors: [],
      };
    }

    if (!NetworkManager.isConnected()) {
      log.info('No network connection, skipping sync');
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errors: [],
      };
    }

    return this.performSync();
  }

  private async performSync(): Promise<SyncResult> {
    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      log.info('Starting sync process');

      // Get all pending sync items
      const syncQueue = await OfflineStorage.getSyncQueue();
      
      if (syncQueue.length === 0) {
        log.info('No items to sync');
        return result;
      }

      log.info(`Found ${syncQueue.length} items to sync`);

      // Sort by priority and timestamp
      const sortedItems = this.sortSyncItems(syncQueue);

      // Process items in batches to avoid overwhelming the server
      const batchSize = 5;
      for (let i = 0; i < sortedItems.length; i += batchSize) {
        const batch = sortedItems.slice(i, i + batchSize);
        await this.processBatch(batch, result);

        // Check if we're still connected between batches
        if (!NetworkManager.isConnected()) {
          log.info('Lost connection during sync, stopping');
          break;
        }

        // Small delay between batches
        if (i + batchSize < sortedItems.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      log.info(`Sync completed: ${result.syncedCount} succeeded, ${result.failedCount} failed`);
    } catch (error) {
      log.error('Error during sync process:', error);
      result.success = false;
    } finally {
      this.isSyncing = false;
      this.notifyListeners(result);
    }

    return result;
  }

  private sortSyncItems(items: SyncItem[]): SyncItem[] {
    return items.sort((a, b) => {
      // First sort by priority
      const priorityA = this.PRIORITY_ORDER.indexOf(a.priority);
      const priorityB = this.PRIORITY_ORDER.indexOf(b.priority);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Then by timestamp (oldest first)
      return a.timestamp - b.timestamp;
    });
  }

  private async processBatch(batch: SyncItem[], result: SyncResult): Promise<void> {
    const promises = batch.map(item => this.syncItem(item, result));
    await Promise.allSettled(promises);
  }

  private async syncItem(item: SyncItem, result: SyncResult): Promise<void> {
    try {
      log.info(`Syncing ${item.entityType} (${item.method} ${item.endpoint})`);

      let response;
      switch (item.method) {
        case 'POST':
          response = await baseApi.post(item.endpoint, item.data);
          break;
        case 'PUT':
          response = await baseApi.put(item.endpoint, item.data);
          break;
        case 'DELETE':
          response = await baseApi.delete(item.endpoint);
          break;
        case 'GET':
          response = await baseApi.get(item.endpoint);
          break;
        default:
          throw new Error(`Unsupported method: ${item.method}`);
      }

      // Success - remove from queue
      await OfflineStorage.removeFromSyncQueue(item.id);
      result.syncedCount++;

      log.info(`Successfully synced ${item.entityType}`);

      // Handle specific entity types
      await this.handleSyncSuccess(item, response);

    } catch (error) {
      log.error(`Failed to sync ${item.entityType}:`, error);
      
      item.retryCount++;
      
      if (item.retryCount >= item.maxRetries) {
        // Max retries reached, remove from queue and log error
        await OfflineStorage.removeFromSyncQueue(item.id);
        result.failedCount++;
        result.errors.push({
          item,
          error: `Max retries (${item.maxRetries}) reached: ${(error as Error).message}`,
        });
        
        // Handle failed sync
        await this.handleSyncFailure(item, error as Error);
      } else {
        // Update retry count in queue
        const syncQueue = await OfflineStorage.getSyncQueue();
        const updatedQueue = syncQueue.map(queueItem =>
          queueItem.id === item.id ? { ...queueItem, retryCount: item.retryCount } : queueItem
        );
        
        // Store updated queue
        await OfflineStorage.clearSyncQueue();
        for (const queueItem of updatedQueue) {
          await OfflineStorage.addToSyncQueue(queueItem, queueItem.endpoint, queueItem.method);
        }
        
        log.info(`Will retry ${item.entityType} (attempt ${item.retryCount}/${item.maxRetries})`);
      }
    }
  }

  private async handleSyncSuccess(item: SyncItem, response: any): Promise<void> {
    try {
      switch (item.entityType) {
        case 'message':
          // Update local message with server response
          await this.updateLocalMessage(item, response);
          break;
        case 'booking':
          // Update local booking status
          await this.updateLocalBooking(item, response);
          break;
        case 'location':
          // Location updates usually don't need local updates
          break;
        case 'package':
          // Update local package data
          await this.updateLocalPackage(item, response);
          break;
      }
    } catch (error) {
      log.error('Error handling sync success:', error);
    }
  }

  private async handleSyncFailure(item: SyncItem, error: Error): Promise<void> {
    try {
      switch (item.entityType) {
        case 'message':
          // Mark message as failed to send
          await this.markMessageAsFailed(item);
          break;
        case 'booking':
          // Handle booking sync failure
          await this.handleBookingSyncFailure(item, error);
          break;
      }
    } catch (handlingError) {
      log.error('Error handling sync failure:', handlingError);
    }
  }

  private async updateLocalMessage(item: SyncItem, response: any): Promise<void> {
    // Update message status in local storage/cache
    const cacheKey = `message_${item.entityId}`;
    const cachedMessage = await OfflineStorage.getCache(cacheKey);
    
    if (cachedMessage) {
      const updatedMessage = {
        ...cachedMessage,
        isDelivered: true,
        serverId: response.id,
        syncedAt: new Date().toISOString(),
      };
      
      await OfflineStorage.setCache(cacheKey, updatedMessage);
    }
  }

  private async updateLocalBooking(item: SyncItem, response: any): Promise<void> {
    // Update booking in cache
    const cacheKey = `booking_${item.entityId}`;
    const cachedBooking = await OfflineStorage.getCache(cacheKey);
    
    if (cachedBooking) {
      const updatedBooking = {
        ...cachedBooking,
        ...response,
        syncedAt: new Date().toISOString(),
      };
      
      await OfflineStorage.setCache(cacheKey, updatedBooking);
    }
  }

  private async updateLocalPackage(item: SyncItem, response: any): Promise<void> {
    // Update package data in cache
    const cacheKey = `package_${item.entityId}`;
    await OfflineStorage.setCache(cacheKey, response);
  }

  private async markMessageAsFailed(item: SyncItem): Promise<void> {
    const cacheKey = `message_${item.entityId}`;
    const cachedMessage = await OfflineStorage.getCache(cacheKey);
    
    if (cachedMessage) {
      const updatedMessage = {
        ...cachedMessage,
        isFailed: true,
        failedAt: new Date().toISOString(),
      };
      
      await OfflineStorage.setCache(cacheKey, updatedMessage);
    }
  }

  private async handleBookingSyncFailure(item: SyncItem, error: Error): Promise<void> {
    // Handle booking-specific failure logic
    log.error(`Booking sync failed for ${item.entityId}:`, error.message);
  }

  // Listener management
  addSyncListener(callback: (result: SyncResult) => void): string {
    const id = `sync_listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.syncListeners.push({ id, callback });
    return id;
  }

  removeSyncListener(id: string): void {
    this.syncListeners = this.syncListeners.filter(listener => listener.id !== id);
  }

  private notifyListeners(result: SyncResult): void {
    this.syncListeners.forEach(listener => {
      try {
        listener.callback(result);
      } catch (error) {
        log.error('Error in sync listener callback:', error);
      }
    });
  }

  // Public methods
  async forcSync(): Promise<SyncResult> {
    log.info('Force sync requested');
    return this.syncWhenReady();
  }

  async clearSyncQueue(): Promise<void> {
    await OfflineStorage.clearSyncQueue();
    log.info('Sync queue cleared');
  }

  async getSyncQueueSize(): Promise<number> {
    const queue = await OfflineStorage.getSyncQueue();
    return queue.length;
  }

  async getSyncStats(): Promise<{
    queueSize: number;
    isOnline: boolean;
    isSyncing: boolean;
    networkQuality: string;
  }> {
    const queueSize = await this.getSyncQueueSize();
    const networkState = NetworkManager.getCurrentState();
    
    return {
      queueSize,
      isOnline: NetworkManager.isConnected(),
      isSyncing: this.isSyncing,
      networkQuality: networkState.connectionQuality,
    };
  }

  // Cleanup
  destroy(): void {
    this.stopPeriodicSync();
    
    if (this.networkListenerId) {
      NetworkManager.removeListener(this.networkListenerId);
      this.networkListenerId = null;
    }
    
    this.syncListeners = [];
    this.isInitialized = false;
    log.info('SyncManager destroyed');
  }
}

export default new SyncManager();