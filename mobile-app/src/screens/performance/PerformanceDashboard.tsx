/**
 * @fileoverview Performance monitoring dashboard
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import { Card, Button } from '../../components/ui';
import memoryManager, { MemoryWarning } from '../../utils/performance/MemoryManager';
import logger from '../../services/LoggingService';

const log = logger.createLogger('PerformanceDashboard');

interface MemoryStats {
  totalMemory: number;
  usedMemory: number;
  freeMemory: number;
  memoryPressure: 'low' | 'medium' | 'high' | 'critical';
  warnings: MemoryWarning[];
}

const PerformanceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 60,
    renderTime: 16.67,
    jsBundleSize: 0,
    nativeMemory: 0,
    jsHeapSize: 0,
  });

  // memoryManager is already imported as singleton instance

  useEffect(() => {
    loadPerformanceData();
    setupMemoryMonitoring();
  }, []);

  const loadPerformanceData = async (): Promise<void> => {
    setLoading(true);
    try {
      // Get memory statistics
      const stats = await getMemoryStats();
      setMemoryStats(stats);
      
      // Get performance metrics
      await loadPerformanceMetrics();
    } catch (error) {
      log.error('Error loading performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMemoryStats = async (): Promise<MemoryStats> => {
    // In a real implementation, this would get actual memory stats
    const managerStats = memoryManager.getMemoryStats();
    
    return {
      totalMemory: 4096, // 4GB
      usedMemory: 2048,  // 2GB
      freeMemory: 2048,  // 2GB
      memoryPressure: managerStats.warnings.length > 5 ? 'high' : managerStats.warnings.length > 2 ? 'medium' : 'low',
      warnings: managerStats.warnings,
    };
  };

  const loadPerformanceMetrics = async (): Promise<void> => {
    // Simulate performance metrics
    setPerformanceMetrics({
      fps: Math.floor(Math.random() * 10) + 55, // 55-65 FPS
      renderTime: Math.random() * 5 + 14, // 14-19ms
      jsBundleSize: 15.2, // MB
      nativeMemory: 45.8, // MB
      jsHeapSize: 23.4, // MB
    });
  };

  const setupMemoryMonitoring = (): (() => void) => {
    // Setup periodic memory monitoring
    const interval = setInterval(() => {
      loadPerformanceData();
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  };

  const handleClearMemoryWarnings = (): void => {
    Alert.alert(
      'Clear Warnings',
      'Are you sure you want to clear all memory warnings?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => {
            memoryManager.clearMemoryWarnings();
            loadPerformanceData();
          },
        },
      ]
    );
  };

  const handleForceCleanup = (): void => {
    Alert.alert(
      'Force Memory Cleanup',
      'This will attempt to free up memory by cleaning up unused resources. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cleanup',
          onPress: () => {
            memoryManager.forceCleanup();
            setTimeout(() => {
              loadPerformanceData();
            }, 2000);
          },
        },
      ]
    );
  };

  const getMemoryPressureColor = (pressure: string): string => {
    switch (pressure) {
      case 'low':
        return '#4CAF50';
      case 'medium':
        return '#FF9800';
      case 'high':
        return '#F44336';
      case 'critical':
        return '#D32F2F';
      default:
        return '#9E9E9E';
    }
  };

  const getPerformanceStatus = (fps: number): { text: string; color: string } => {
    if (fps >= 58) return { text: 'Excellent', color: '#4CAF50' };
    if (fps >= 45) return { text: 'Good', color: '#8BC34A' };
    if (fps >= 30) return { text: 'Fair', color: '#FF9800' };
    return { text: 'Poor', color: '#F44336' };
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderMemoryOverview = (): JSX.Element => (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Memory Usage</Text>
      
      {memoryStats && (
        <>
          <View style={styles.memoryBar}>
            <View style={styles.memoryBarBackground}>
              <View 
                style={[
                  styles.memoryBarFill,
                  {
                    width: `${(memoryStats.usedMemory / memoryStats.totalMemory) * 100}%`,
                    backgroundColor: getMemoryPressureColor(memoryStats.memoryPressure),
                  }
                ]}
              />
            </View>
          </View>
          
          <View style={styles.memoryStats}>
            <View style={styles.memoryStat}>
              <Text style={styles.memoryLabel}>Used</Text>
              <Text style={styles.memoryValue}>{formatBytes(memoryStats.usedMemory * 1024 * 1024)}</Text>
            </View>
            <View style={styles.memoryStat}>
              <Text style={styles.memoryLabel}>Free</Text>
              <Text style={styles.memoryValue}>{formatBytes(memoryStats.freeMemory * 1024 * 1024)}</Text>
            </View>
            <View style={styles.memoryStat}>
              <Text style={styles.memoryLabel}>Pressure</Text>
              <Text style={[
                styles.memoryValue,
                { color: getMemoryPressureColor(memoryStats.memoryPressure) }
              ]}>
                {memoryStats.memoryPressure.toUpperCase()}
              </Text>
            </View>
          </View>
        </>
      )}
    </Card>
  );

  const renderPerformanceMetrics = (): JSX.Element => {
    const performanceStatus = getPerformanceStatus(performanceMetrics.fps);
    
    return (
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Performance Metrics</Text>
        
        <View style={styles.metricsGrid}>
          <View style={styles.metric}>
            <Icon name="speed" size={24} color={performanceStatus.color} />
            <Text style={styles.metricLabel}>FPS</Text>
            <Text style={[styles.metricValue, { color: performanceStatus.color }]}>
              {performanceMetrics.fps.toFixed(0)}
            </Text>
            <Text style={styles.metricSubtext}>{performanceStatus.text}</Text>
          </View>
          
          <View style={styles.metric}>
            <Icon name="timer" size={24} color={colors.text.secondary} />
            <Text style={styles.metricLabel}>Render Time</Text>
            <Text style={styles.metricValue}>
              {performanceMetrics.renderTime.toFixed(1)}ms
            </Text>
            <Text style={styles.metricSubtext}>Per Frame</Text>
          </View>
          
          <View style={styles.metric}>
            <Icon name="storage" size={24} color={colors.text.secondary} />
            <Text style={styles.metricLabel}>JS Heap</Text>
            <Text style={styles.metricValue}>
              {performanceMetrics.jsHeapSize.toFixed(1)}MB
            </Text>
            <Text style={styles.metricSubtext}>JavaScript</Text>
          </View>
          
          <View style={styles.metric}>
            <Icon name="memory" size={24} color={colors.text.secondary} />
            <Text style={styles.metricLabel}>Native</Text>
            <Text style={styles.metricValue}>
              {performanceMetrics.nativeMemory.toFixed(1)}MB
            </Text>
            <Text style={styles.metricSubtext}>Native Memory</Text>
          </View>
        </View>
      </Card>
    );
  };

  const renderMemoryWarnings = (): JSX.Element => (
    <Card style={styles.card}>
      <View style={styles.warningsHeader}>
        <Text style={styles.cardTitle}>Memory Warnings</Text>
        {memoryStats?.warnings && memoryStats.warnings.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearMemoryWarnings}
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {memoryStats?.warnings && memoryStats.warnings.length > 0 ? (
        <ScrollView style={styles.warningsList} nestedScrollEnabled>
          {memoryStats.warnings.map((warning: { level: string; message?: string; timestamp: string | number }, index: number) => (
            <View key={index} style={styles.warningItem}>
              <Icon 
                name={
                  warning.level === 'critical' ? 'error' :
                  warning.level === 'high' ? 'warning' :
                  warning.level === 'medium' ? 'info' : 'help'
                }
                size={20}
                color={getMemoryPressureColor(warning.level)}
              />
              <View style={styles.warningContent}>
                <Text style={styles.warningMessage}>{warning.message || 'Memory warning'}</Text>
                <Text style={styles.warningTime}>
                  {new Date(warning.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.noWarnings}>
          <Icon name="check-circle" size={48} color="#4CAF50" />
          <Text style={styles.noWarningsText}>No memory warnings</Text>
          <Text style={styles.noWarningsSubtext}>System is running smoothly</Text>
        </View>
      )}
    </Card>
  );

  const renderActions = (): JSX.Element => (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Performance Actions</Text>
      
      <View style={styles.actionsGrid}>
        <Button
          title="Force Cleanup"
          onPress={handleForceCleanup}
          variant="outline"
          size="medium"
          icon="cleaning-services"
        />
        
        <Button
          title="Refresh Data"
          onPress={loadPerformanceData}
          variant="outline"
          size="medium"
          icon="refresh"
          loading={loading}
        />
      </View>
    </Card>
  );

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadPerformanceData}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.content}>
        <Text style={styles.screenTitle}>Performance Monitor</Text>
        
        {renderMemoryOverview()}
        {renderPerformanceMetrics()}
        {renderMemoryWarnings()}
        {renderActions()}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  memoryBar: {
    marginBottom: 16,
  },
  memoryBarBackground: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  memoryBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  memoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  memoryStat: {
    alignItems: 'center',
  },
  memoryLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  memoryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metric: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 8,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  metricSubtext: {
    fontSize: 10,
    color: colors.text.secondary,
    marginTop: 2,
  },
  warningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.error,
    borderRadius: 4,
  },
  clearButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  warningsList: {
    maxHeight: 200,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    padding: 8,
    backgroundColor: colors.background.secondary,
    borderRadius: 6,
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningMessage: {
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 4,
  },
  warningTime: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  noWarnings: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noWarningsText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.primary,
    marginTop: 12,
  },
  noWarningsSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});

export default PerformanceDashboard;