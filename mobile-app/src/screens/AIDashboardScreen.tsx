/**
 * @fileoverview AI Dashboard Screen for monitoring predictions and insights
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { LineChart, BarChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import PredictiveAIService, { PredictiveInsights, MarketConditions } from '../services/PredictiveAIService';
import { PredictiveInsightsCard } from '../components/PredictiveInsightsCard';
// import { useAuth } from '../contexts/AuthContext';
const useAuth = () => ({ user: { id: 'mock-user', firstName: 'Mock', lastName: 'User' } });
// import { useLocation } from '../hooks/useLocation';
const useLocation = () => ({ location: { latitude: 0, longitude: 0 }, loading: false });
import { colors, spacing, typography } from '../theme';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - (spacing.md * 2);

interface HistoricalData {
  demand: number[];
  pricing: number[];
  waitTime: number[];
  timestamps: string[];
}

export const AIDashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const { location } = useLocation();
  
  const [insights, setInsights] = useState<PredictiveInsights | null>(null);
  const [marketConditions, setMarketConditions] = useState<MarketConditions | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'demand' | 'pricing' | 'waitTime'>('demand');

  useEffect(() => {
    if (location) {
      loadDashboardData();
    }
  }, [location]);

  const loadDashboardData = async () => {
    if (!location) return;

    try {
      setLoading(true);

      // Load current insights
      const insightsResponse = await PredictiveAIService.getPredictiveInsights(
        location.latitude,
        location.longitude,
        25 // Base price for pricing insights
      );

      if (insightsResponse.success && insightsResponse.data) {
        setInsights(insightsResponse.data);
        setMarketConditions(insightsResponse.data.market_conditions);
      }

      // Generate mock historical data (in production, this would come from backend)
      generateMockHistoricalData();

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert(
        'Error',
        'Failed to load AI dashboard data. Some features may be unavailable.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateMockHistoricalData = () => {
    // Generate 24 hours of mock data
    const timestamps = [];
    const demand = [];
    const pricing = [];
    const waitTime = [];

    for (let i = 0; i < 24; i++) {
      const hour = new Date();
      hour.setHours(hour.getHours() - (23 - i));
      timestamps.push(hour.toLocaleTimeString('en-US', { hour: '2-digit' }));

      // Simulate demand patterns (higher during rush hours)
      let demandValue = 5 + Math.random() * 5;
      if ((i >= 7 && i <= 9) || (i >= 17 && i <= 19)) {
        demandValue += 10 + Math.random() * 10;
      }
      demand.push(Math.round(demandValue));

      // Simulate pricing (higher when demand is high)
      const basePrice = 25;
      const surgeMultiplier = 1 + (demandValue / 30) + (Math.random() - 0.5) * 0.3;
      pricing.push(Math.round(basePrice * surgeMultiplier * 100) / 100);

      // Simulate wait times (longer when demand is high relative to supply)
      const waitTimeValue = 3 + (demandValue / 5) + Math.random() * 3;
      waitTime.push(Math.round(waitTimeValue * 10) / 10);
    }

    setHistoricalData({
      demand,
      pricing,
      waitTime,
      timestamps
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  const renderMetricSelector = () => (
    <View style={styles.metricSelector}>
      <TouchableOpacity
        style={[styles.metricButton, selectedMetric === 'demand' && styles.metricButtonActive]}
        onPress={() => setSelectedMetric('demand')}
      >
        <Ionicons 
          name="trending-up" 
          size={20} 
          color={selectedMetric === 'demand' ? colors.white : colors.primary} 
        />
        <Text style={[
          styles.metricButtonText,
          selectedMetric === 'demand' && styles.metricButtonTextActive
        ]}>
          Demand
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.metricButton, selectedMetric === 'pricing' && styles.metricButtonActive]}
        onPress={() => setSelectedMetric('pricing')}
      >
        <MaterialIcons 
          name="attach-money" 
          size={20} 
          color={selectedMetric === 'pricing' ? colors.white : colors.primary} 
        />
        <Text style={[
          styles.metricButtonText,
          selectedMetric === 'pricing' && styles.metricButtonTextActive
        ]}>
          Pricing
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.metricButton, selectedMetric === 'waitTime' && styles.metricButtonActive]}
        onPress={() => setSelectedMetric('waitTime')}
      >
        <Ionicons 
          name="time" 
          size={20} 
          color={selectedMetric === 'waitTime' ? colors.white : colors.primary} 
        />
        <Text style={[
          styles.metricButtonText,
          selectedMetric === 'waitTime' && styles.metricButtonTextActive
        ]}>
          Wait Time
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderChart = () => {
    if (!historicalData) return null;

    const chartData = {
      labels: historicalData.timestamps.filter((_, index) => index % 4 === 0), // Show every 4th hour
      datasets: [{
        data: selectedMetric === 'demand' ? historicalData.demand :
              selectedMetric === 'pricing' ? historicalData.pricing :
              historicalData.waitTime,
        color: (opacity = 1) => colors.primary + Math.round(opacity * 255).toString(16),
        strokeWidth: 2,
      }]
    };

    const chartConfig = {
      backgroundColor: colors.surface,
      backgroundGradientFrom: colors.surface,
      backgroundGradientTo: colors.surface,
      decimalPlaces: selectedMetric === 'demand' ? 0 : 1,
      color: (opacity = 1) => colors.primary + Math.round(opacity * 255).toString(16),
      labelColor: (opacity = 1) => colors.text.secondary + Math.round(opacity * 255).toString(16),
      style: {
        borderRadius: 12,
      },
      propsForDots: {
        r: "4",
        strokeWidth: "2",
        stroke: colors.primary
      }
    };

    const getYAxisSuffix = () => {
      switch (selectedMetric) {
        case 'demand': return ' rides';
        case 'pricing': return '$';
        case 'waitTime': return 'm';
        default: return '';
      }
    };

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>
          24-Hour {selectedMetric === 'demand' ? 'Demand' : 
                    selectedMetric === 'pricing' ? 'Pricing' : 'Wait Time'} Trend
        </Text>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          yAxisSuffix={getYAxisSuffix()}
          withDots={true}
          withShadow={true}
          withScrollableDot={true}
          withInnerLines={false}
          withOuterLines={false}
        />
      </View>
    );
  };

  const renderQuickStats = () => {
    if (!insights) return null;

    const stats = [
      {
        title: 'Current Demand',
        value: Math.round(insights.demand_forecast.prediction),
        unit: 'rides',
        icon: 'trending-up',
        color: PredictiveAIService.getDemandColor(insights.demand_forecast.prediction),
        confidence: insights.demand_forecast.confidence
      },
      {
        title: 'Avg Wait Time',
        value: Math.round(insights.wait_time_estimate.prediction),
        unit: 'min',
        icon: 'time',
        color: insights.wait_time_estimate.prediction > 10 ? colors.error : colors.success,
        confidence: insights.wait_time_estimate.confidence
      },
      {
        title: 'Price Impact',
        value: `${Math.round(((insights.optimal_pricing.prediction / 25) - 1) * 100)}%`,
        unit: '',
        icon: 'attach-money',
        color: insights.optimal_pricing.prediction > 30 ? colors.error : colors.success,
        confidence: insights.optimal_pricing.confidence
      }
    ];

    return (
      <View style={styles.quickStatsContainer}>
        <Text style={styles.sectionTitle}>Current Predictions</Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <View style={styles.statHeader}>
                <MaterialIcons name={stat.icon as any} size={24} color={stat.color} />
                <View style={styles.confidenceIndicator}>
                  <View 
                    style={[
                      styles.confidenceDot,
                      { backgroundColor: PredictiveAIService.getConfidenceColor(stat.confidence) }
                    ]} 
                  />
                </View>
              </View>
              <Text style={[styles.statValue, { color: stat.color }]}>
                {stat.value}{stat.unit}
              </Text>
              <Text style={styles.statTitle}>{stat.title}</Text>
              <Text style={styles.confidenceText}>
                {PredictiveAIService.formatConfidence(stat.confidence)} confidence
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderMarketSummary = () => {
    if (!marketConditions) return null;

    return (
      <View style={styles.marketSummaryContainer}>
        <Text style={styles.sectionTitle}>Market Summary</Text>
        <View style={styles.marketGrid}>
          <View style={styles.marketItem}>
            <Ionicons 
              name={PredictiveAIService.getWeatherIcon(marketConditions.weather.condition)} 
              size={32} 
              color={colors.primary} 
            />
            <Text style={styles.marketItemTitle}>Weather</Text>
            <Text style={styles.marketItemValue}>
              {Math.round(marketConditions.weather.temperature)}°C
            </Text>
            <Text style={styles.marketItemSubtext}>
              {marketConditions.weather.condition}
            </Text>
          </View>

          <View style={styles.marketItem}>
            <MaterialIcons 
              name={PredictiveAIService.getTrafficIcon(marketConditions.traffic.congestion_level)} 
              size={32} 
              color={colors.primary} 
            />
            <Text style={styles.marketItemTitle}>Traffic</Text>
            <Text style={styles.marketItemValue}>
              {marketConditions.traffic.congestion_level}
            </Text>
            <Text style={styles.marketItemSubtext}>
              +{Math.round(marketConditions.traffic.estimated_delay)}m delay
            </Text>
          </View>
        </View>

        <View style={styles.compositeScores}>
          <Text style={styles.compositeTitle}>Market Multipliers</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Demand:</Text>
            <Text style={[
              styles.scoreValue,
              { color: marketConditions.composite_scores.demand_multiplier > 1.5 ? colors.error : colors.success }
            ]}>
              {marketConditions.composite_scores.demand_multiplier.toFixed(2)}x
            </Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Price Impact:</Text>
            <Text style={[
              styles.scoreValue,
              { color: marketConditions.composite_scores.price_impact > 1.3 ? colors.error : colors.success }
            ]}>
              {marketConditions.composite_scores.price_impact.toFixed(2)}x
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderAIRecommendations = () => {
    if (!insights || !insights.recommendations.length) return null;

    return (
      <View style={styles.recommendationsContainer}>
        <Text style={styles.sectionTitle}>AI Recommendations</Text>
        {insights.recommendations.map((recommendation, index) => (
          <View key={index} style={styles.recommendationCard}>
            <MaterialIcons name="lightbulb" size={20} color={colors.warning} />
            <Text style={styles.recommendationText}>{recommendation}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (!location) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="location-off" size={64} color={colors.text.secondary} />
          <Text style={styles.errorTitle}>Location Required</Text>
          <Text style={styles.errorText}>
            Please enable location services to view AI insights
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Dashboard</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Main Insights Card */}
        <PredictiveInsightsCard
          latitude={location.latitude}
          longitude={location.longitude}
          basePrice={25}
          onInsightsLoaded={setInsights}
          minimized={false}
        />

        {/* Quick Stats */}
        {renderQuickStats()}

        {/* Chart Section */}
        {renderMetricSelector()}
        {renderChart()}

        {/* Market Summary */}
        {renderMarketSummary()}

        {/* AI Recommendations */}
        {renderAIRecommendations()}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Data updated {new Date().toLocaleTimeString()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: typography.fontSize.title,
    color: colors.text.primary,
  },
  refreshButton: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorTitle: {
    fontSize: typography.fontSize.title,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  quickStatsContainer: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.sm,
  },
  confidenceIndicator: {
    width: 8,
    height: 8,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statValue: {
    fontSize: typography.fontSize.title,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  statTitle: {
    fontSize: typography.fontSize.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  confidenceText: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  metricSelector: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  metricButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginHorizontal: spacing.xs,
  },
  metricButtonActive: {
    backgroundColor: colors.primary,
  },
  metricButtonText: {
    fontSize: typography.fontSize.caption,
    color: colors.primary,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  metricButtonTextActive: {
    color: colors.white,
  },
  chartContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  chartTitle: {
    fontSize: typography.fontSize.body,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 12,
  },
  marketSummaryContainer: {
    padding: spacing.md,
  },
  marketGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  marketItem: {
    alignItems: 'center',
    flex: 1,
  },
  marketItemTitle: {
    fontSize: typography.fontSize.caption,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  marketItemValue: {
    fontSize: typography.fontSize.body,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  marketItemSubtext: {
    fontSize: typography.fontSize.caption,
    color: colors.text.secondary,
  },
  compositeScores: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
  },
  compositeTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  scoreLabel: {
    fontSize: typography.fontSize.caption,
    color: colors.text.secondary,
  },
  scoreValue: {
    fontSize: typography.fontSize.body,
    fontWeight: 'bold',
  },
  recommendationsContainer: {
    padding: spacing.md,
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  recommendationText: {
    fontSize: typography.fontSize.body,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.fontSize.caption,
    color: colors.text.secondary,
  },
});

export default AIDashboardScreen;