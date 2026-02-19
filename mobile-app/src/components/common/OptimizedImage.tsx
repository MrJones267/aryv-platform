/**
 * @fileoverview Optimized image component with lazy loading and caching
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  ImageProps,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import ImageOptimizer, { ImageOptimizationOptions } from '../../utils/performance/ImageOptimizer';
import PerformanceMonitor from '../../utils/performance/PerformanceMonitor';
import logger from '../../services/LoggingService';

const log = logger.createLogger('OptimizedImage');

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  uri: string;
  placeholder?: string;
  fallbackIcon?: string;
  lazy?: boolean;
  threshold?: number; // Distance from viewport to start loading
  optimizationOptions?: ImageOptimizationOptions;
  showLoadingIndicator?: boolean;
  showErrorState?: boolean;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: unknown) => void;
  retryable?: boolean;
  maxRetries?: number;
  fadeDuration?: number;
  progressiveLoading?: boolean;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  uri,
  placeholder,
  fallbackIcon = 'image',
  lazy = true,
  threshold = 100,
  optimizationOptions = {},
  showLoadingIndicator = true,
  showErrorState = true,
  onLoadStart,
  onLoadEnd,
  onError,
  retryable = true,
  maxRetries = 3,
  fadeDuration = 300,
  progressiveLoading = true,
  style,
  ...imageProps
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [inViewport, setInViewport] = useState(!lazy);
  const [lowQualityLoaded, setLowQualityLoaded] = useState(false);
  
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const loadingTimerId = useRef<string | null>(null);
  const viewRef = useRef<View>(null);

  useEffect(() => {
    if (inViewport && uri && !imageUri && !loading && !error) {
      loadImage();
    }
  }, [inViewport, uri, imageUri, loading, error]);

  useEffect(() => {
    // Check if image is already cached
    if (uri && ImageOptimizer.isCached(uri)) {
      const cachedPath = ImageOptimizer.getCachedImagePath(uri);
      if (cachedPath) {
        setImageUri(cachedPath);
        setInViewport(true);
      }
    }
  }, [uri]);

  const loadImage = async () => {
    if (!uri) return;

    setLoading(true);
    setError(null);
    onLoadStart?.();

    // Start performance monitoring
    loadingTimerId.current = PerformanceMonitor.startTiming(`image_load_${uri}`, 'render');

    try {
      // Load low quality version first if progressive loading is enabled
      if (progressiveLoading && placeholder) {
        setImageUri(placeholder);
        setLowQualityLoaded(true);
      }

      // Optimize and load the image
      const optimizedUri = await ImageOptimizer.optimizeImage(uri, {
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.8,
        format: 'jpeg',
        cacheEnabled: true,
        ...optimizationOptions,
      });

      setImageUri(optimizedUri);
      setLoading(false);
      onLoadEnd?.();

      // Animate fade in
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: fadeDuration,
        useNativeDriver: true,
      }).start();

      // End performance monitoring
      if (loadingTimerId.current) {
        PerformanceMonitor.endTiming(loadingTimerId.current, {
          uri,
          cached: ImageOptimizer.isCached(uri),
          optimized: true,
        });
      }

    } catch (loadError) {
      log.error('Error loading image:', loadError);
      setLoading(false);
      setError((loadError as Error).message);
      onError?.(loadError);

      // End performance monitoring with error
      if (loadingTimerId.current) {
        PerformanceMonitor.endTiming(loadingTimerId.current, {
          uri,
          error: (loadError as Error).message,
        });
      }
    }
  };

  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setError(null);
      setImageUri(null);
      fadeAnimation.setValue(0);
      loadImage();
    }
  };

  const handleLayout = () => {
    if (!lazy || inViewport) return;

    // Simple viewport detection - in a real app, you'd use a proper intersection observer
    // or a library like react-native-super-grid with lazy loading
    if (viewRef.current) {
      viewRef.current.measure((x, y, width, height, pageX, pageY) => {
        // Simplified viewport check
        if (pageY < 1000) { // Assume viewport height
          setInViewport(true);
        }
      });
    }
  };

  const renderPlaceholder = () => {
    if (placeholder && !lowQualityLoaded) {
      return (
        <Image
          source={{ uri: placeholder }}
          style={[styles.placeholder, style]}
          blurRadius={2}
        />
      );
    }

    return (
      <View style={[styles.placeholder, style, styles.defaultPlaceholder]}>
        <Icon 
          name={fallbackIcon} 
          size={Math.min(60, Number((style as Record<string, unknown>)?.width || 120) / 3 || 40)}
          color={colors.text.secondary} 
        />
      </View>
    );
  };

  const renderLoadingIndicator = () => {
    if (!showLoadingIndicator) return null;

    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  };

  const renderError = () => {
    if (!showErrorState) return null;

    return (
      <View style={[styles.errorContainer, style]}>
        <Icon name="error-outline" size={40} color={colors.error} />
        <Text style={styles.errorText}>Failed to load image</Text>
        {retryable && retryCount < maxRetries && (
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
        {retryCount >= maxRetries && (
          <Text style={styles.maxRetriesText}>
            Max retries reached ({maxRetries})
          </Text>
        )}
      </View>
    );
  };

  const renderImage = () => {
    if (!imageUri) return null;

    return (
      <Animated.View style={{ opacity: fadeAnimation }}>
        <Image
          {...imageProps}
          source={{ uri: imageUri }}
          style={style}
          onError={(e) => {
            setError('Image failed to load');
            onError?.(e.nativeEvent.error);
          }}
          onLoad={() => {
            // If this was a progressive load, update to show full quality
            if (lowQualityLoaded) {
              setLowQualityLoaded(false);
            }
          }}
        />
      </Animated.View>
    );
  };

  return (
    <View 
      ref={viewRef}
      style={[styles.container, style]}
      onLayout={handleLayout}
    >
      {!inViewport && renderPlaceholder()}
      
      {inViewport && !imageUri && !error && (
        <>
          {renderPlaceholder()}
          {loading && renderLoadingIndicator()}
        </>
      )}
      
      {error && renderError()}
      {imageUri && !error && renderImage()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.background.secondary,
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  defaultPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border.light,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  loadingText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 8,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error + '10',
    padding: 16,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  retryButtonText: {
    color: colors.text.inverse,
    fontSize: 12,
    fontWeight: '600',
  },
  maxRetriesText: {
    fontSize: 10,
    color: colors.text.secondary,
    marginTop: 4,
  },
});

export default OptimizedImage;