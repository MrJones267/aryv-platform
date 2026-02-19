/**
 * @fileoverview Image optimization utility for better performance and loading
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Image, ImageResizeMode, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import logger from '../../services/LoggingService';

const log = logger.createLogger('ImageOptimizer');

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  format?: 'jpeg' | 'png' | 'webp';
  cacheEnabled?: boolean;
  placeholder?: string;
  progressive?: boolean;
}

export interface CachedImage {
  uri: string;
  localPath: string;
  originalSize: number;
  optimizedSize: number;
  timestamp: number;
  dimensions: { width: number; height: number };
}

export interface ImageMetrics {
  totalImages: number;
  totalOriginalSize: number;
  totalOptimizedSize: number;
  cacheSizeBytes: number;
  averageLoadTime: number;
  cacheHitRate: number;
}

class ImageOptimizer {
  private cache: Map<string, CachedImage> = new Map();
  private readonly CACHE_DIR = `${RNFS.CachesDirectoryPath}/optimized_images`;
  private readonly CACHE_KEY = 'hitch_image_cache';
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  private loadingPromises: Map<string, Promise<string>> = new Map();
  private metrics: ImageMetrics = {
    totalImages: 0,
    totalOriginalSize: 0,
    totalOptimizedSize: 0,
    cacheSizeBytes: 0,
    averageLoadTime: 0,
    cacheHitRate: 0,
  };

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Create cache directory
      await this.ensureCacheDirectoryExists();
      
      // Load cached images metadata
      await this.loadCacheMetadata();
      
      // Clean up old cache files
      await this.cleanupOldCache();
      
      log.info('ImageOptimizer initialized');
    } catch (error) {
      log.error('Error initializing ImageOptimizer:', error);
    }
  }

  private async ensureCacheDirectoryExists(): Promise<void> {
    const dirExists = await RNFS.exists(this.CACHE_DIR);
    if (!dirExists) {
      await RNFS.mkdir(this.CACHE_DIR);
    }
  }

  private async loadCacheMetadata(): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cacheData) {
        const parsed: CachedImage[] = JSON.parse(cacheData);
        parsed.forEach(item => {
          this.cache.set(item.uri, item);
        });
        
        // Update metrics
        this.updateMetrics();
      }
    } catch (error) {
      log.error('Error loading cache metadata:', error);
    }
  }

  private async saveCacheMetadata(): Promise<void> {
    try {
      const cacheArray = Array.from(this.cache.values());
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheArray));
    } catch (error) {
      log.error('Error saving cache metadata:', error);
    }
  }

  private async cleanupOldCache(): Promise<void> {
    try {
      const now = Date.now();
      const expiredKeys: string[] = [];

      for (const [uri, cached] of this.cache.entries()) {
        if (now - cached.timestamp > this.MAX_CACHE_AGE) {
          expiredKeys.push(uri);
          
          // Delete file
          try {
            if (await RNFS.exists(cached.localPath)) {
              await RNFS.unlink(cached.localPath);
            }
          } catch (error) {
            log.warn('Error deleting cached file:', error);
          }
        }
      }

      // Remove from cache
      expiredKeys.forEach(key => this.cache.delete(key));

      if (expiredKeys.length > 0) {
        await this.saveCacheMetadata();
        log.info(`Cleaned up ${expiredKeys.length} expired cached images`);
      }

      // Check total cache size
      await this.enforceCacheSizeLimit();
    } catch (error) {
      log.error('Error cleaning up cache:', error);
    }
  }

  private async enforceCacheSizeLimit(): Promise<void> {
    try {
      const totalSize = await this.calculateCacheSize();
      
      if (totalSize > this.MAX_CACHE_SIZE) {
        // Sort by timestamp (oldest first)
        const sortedCache = Array.from(this.cache.entries())
          .sort(([, a], [, b]) => a.timestamp - b.timestamp);

        let removedSize = 0;
        const targetReduction = totalSize - (this.MAX_CACHE_SIZE * 0.8); // Remove to 80% of limit

        for (const [uri, cached] of sortedCache) {
          if (removedSize >= targetReduction) break;

          try {
            if (await RNFS.exists(cached.localPath)) {
              await RNFS.unlink(cached.localPath);
              removedSize += cached.optimizedSize;
            }
            this.cache.delete(uri);
          } catch (error) {
            log.warn('Error removing cached file during size enforcement:', error);
          }
        }

        await this.saveCacheMetadata();
        log.info(`Enforced cache size limit: removed ${removedSize} bytes`);
      }
    } catch (error) {
      log.error('Error enforcing cache size limit:', error);
    }
  }

  private async calculateCacheSize(): Promise<number> {
    let totalSize = 0;
    for (const cached of this.cache.values()) {
      totalSize += cached.optimizedSize;
    }
    return totalSize;
  }

  private generateCacheKey(uri: string, options: ImageOptimizationOptions): string {
    const optionsKey = JSON.stringify(options);
    return `${uri}_${Buffer.from(optionsKey).toString('base64')}`;
  }

  private async downloadAndOptimizeImage(
    uri: string, 
    options: ImageOptimizationOptions
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Get image dimensions first
      const dimensions = await this.getImageDimensions(uri);
      
      // Calculate optimal dimensions
      const { width, height } = this.calculateOptimalDimensions(
        dimensions.width,
        dimensions.height,
        options
      );

      // Generate local file path
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      const localPath = `${this.CACHE_DIR}/${fileName}`;

      // Download original image
      const downloadResult = await RNFS.downloadFile({
        fromUrl: uri,
        toFile: localPath,
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error(`Download failed with status ${downloadResult.statusCode}`);
      }

      // Get file stats
      const stats = await RNFS.stat(localPath);
      const originalSize = stats.size;

      // For now, we'll use the downloaded file as-is
      // In a real implementation, you'd use a library like react-native-image-resizer
      // to actually optimize the image
      
      const optimizedSize = originalSize; // Placeholder

      // Create cache entry
      const cachedImage: CachedImage = {
        uri,
        localPath,
        originalSize,
        optimizedSize,
        timestamp: Date.now(),
        dimensions: { width, height },
      };

      // Add to cache
      this.cache.set(uri, cachedImage);
      await this.saveCacheMetadata();

      // Update metrics
      this.updateMetricsForNewImage(originalSize, optimizedSize, Date.now() - startTime, false);

      return `file://${localPath}`;
    } catch (error) {
      log.error('Error downloading and optimizing image:', error);
      throw error;
    }
  }

  private async getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        (error) => reject(error)
      );
    });
  }

  private calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    options: ImageOptimizationOptions
  ): { width: number; height: number } {
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;

    const maxWidth = options.maxWidth || screenWidth;
    const maxHeight = options.maxHeight || screenHeight;

    const aspectRatio = originalWidth / originalHeight;

    let targetWidth = originalWidth;
    let targetHeight = originalHeight;

    // Scale down if larger than max dimensions
    if (targetWidth > maxWidth) {
      targetWidth = maxWidth;
      targetHeight = targetWidth / aspectRatio;
    }

    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = targetHeight * aspectRatio;
    }

    return {
      width: Math.round(targetWidth),
      height: Math.round(targetHeight),
    };
  }

  private updateMetrics(): void {
    let totalOriginal = 0;
    let totalOptimized = 0;
    let totalImages = this.cache.size;

    for (const cached of this.cache.values()) {
      totalOriginal += cached.originalSize;
      totalOptimized += cached.optimizedSize;
    }

    this.metrics = {
      ...this.metrics,
      totalImages,
      totalOriginalSize: totalOriginal,
      totalOptimizedSize: totalOptimized,
      cacheSizeBytes: totalOptimized,
    };
  }

  private updateMetricsForNewImage(
    originalSize: number,
    optimizedSize: number,
    loadTime: number,
    cacheHit: boolean
  ): void {
    this.metrics.totalImages++;
    this.metrics.totalOriginalSize += originalSize;
    this.metrics.totalOptimizedSize += optimizedSize;
    this.metrics.cacheSizeBytes += optimizedSize;

    // Update average load time
    const currentAverage = this.metrics.averageLoadTime;
    const totalMeasurements = this.metrics.totalImages;
    this.metrics.averageLoadTime = (currentAverage * (totalMeasurements - 1) + loadTime) / totalMeasurements;

    // Update cache hit rate
    if (cacheHit) {
      const currentHits = this.metrics.cacheHitRate * (totalMeasurements - 1);
      this.metrics.cacheHitRate = (currentHits + 1) / totalMeasurements;
    } else {
      const currentHits = this.metrics.cacheHitRate * (totalMeasurements - 1);
      this.metrics.cacheHitRate = currentHits / totalMeasurements;
    }
  }

  // Public methods
  async optimizeImage(
    uri: string,
    options: ImageOptimizationOptions = {}
  ): Promise<string> {
    if (!uri || !uri.startsWith('http')) {
      return uri; // Return as-is for local images
    }

    const cacheKey = this.generateCacheKey(uri, options);
    
    // Check cache first
    const cached = this.cache.get(uri);
    if (cached && options.cacheEnabled !== false) {
      // Verify file still exists
      if (await RNFS.exists(cached.localPath)) {
        this.updateMetricsForNewImage(
          cached.originalSize,
          cached.optimizedSize,
          0, // No load time for cache hit
          true
        );
        return `file://${cached.localPath}`;
      } else {
        // File missing, remove from cache
        this.cache.delete(uri);
        await this.saveCacheMetadata();
      }
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // Start loading
    const loadingPromise = this.downloadAndOptimizeImage(uri, options);
    this.loadingPromises.set(cacheKey, loadingPromise);

    try {
      const result = await loadingPromise;
      this.loadingPromises.delete(cacheKey);
      return result;
    } catch (error) {
      this.loadingPromises.delete(cacheKey);
      throw error;
    }
  }

  async preloadImages(uris: string[], options: ImageOptimizationOptions = {}): Promise<void> {
    const promises = uris.map(uri => 
      this.optimizeImage(uri, options).catch(error => {
        log.warn(`Failed to preload image ${uri}:`, error);
      })
    );

    await Promise.allSettled(promises);
  }

  getCachedImagePath(uri: string): string | null {
    const cached = this.cache.get(uri);
    return cached ? `file://${cached.localPath}` : null;
  }

  isCached(uri: string): boolean {
    return this.cache.has(uri);
  }

  getMetrics(): ImageMetrics {
    return { ...this.metrics };
  }

  async clearCache(): Promise<void> {
    try {
      // Delete all cached files
      for (const cached of this.cache.values()) {
        try {
          if (await RNFS.exists(cached.localPath)) {
            await RNFS.unlink(cached.localPath);
          }
        } catch (error) {
          log.warn('Error deleting cached file:', error);
        }
      }

      // Clear cache and metadata
      this.cache.clear();
      await AsyncStorage.removeItem(this.CACHE_KEY);

      // Reset metrics
      this.metrics = {
        totalImages: 0,
        totalOriginalSize: 0,
        totalOptimizedSize: 0,
        cacheSizeBytes: 0,
        averageLoadTime: 0,
        cacheHitRate: 0,
      };

      log.info('Image cache cleared');
    } catch (error) {
      log.error('Error clearing image cache:', error);
    }
  }

  getSavingsReport(): {
    spaceSaved: number;
    spaceSavedPercentage: number;
    totalImagesProcessed: number;
  } {
    const spaceSaved = this.metrics.totalOriginalSize - this.metrics.totalOptimizedSize;
    const spaceSavedPercentage = this.metrics.totalOriginalSize > 0 
      ? (spaceSaved / this.metrics.totalOriginalSize) * 100 
      : 0;

    return {
      spaceSaved,
      spaceSavedPercentage,
      totalImagesProcessed: this.metrics.totalImages,
    };
  }
}

export default new ImageOptimizer();