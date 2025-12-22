/**
 * @fileoverview Predictive Insights Card Component
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
// import LinearGradient from 'react-native-linear-gradient';
import PredictiveAIService, { PredictiveInsights } from '../services/PredictiveAIService';
import { colors, spacing, typography } from '../theme';

interface PredictiveInsightsCardProps {
  latitude: number;
  longitude: number;
  basePrice?: number;
  onInsightsLoaded?: (insights: PredictiveInsights) => void;
  minimized?: boolean;
}

export const PredictiveInsightsCard: React.FC<PredictiveInsightsCardProps> = ({
  latitude,
  longitude,
  basePrice,
  onInsightsLoaded,
  minimized = false,
}) => {
  const [insights, setInsights] = useState<PredictiveInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!minimized);
  const [refreshing, setRefreshing] = useState(false);
  const [animatedHeight] = useState(new Animated.Value(minimized ? 0 : 1));

  useEffect(() => {
    loadInsights();
  }, [latitude, longitude, basePrice]);

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: expanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await PredictiveAIService.getPredictiveInsights(
        latitude,
        longitude,
        basePrice
      );

      if (response.success && response.data) {
        setInsights(response.data);
        onInsightsLoaded?.(response.data);
      } else {
        throw new Error(response.message || 'Failed to load insights');
      }
    } catch (err) {
      console.error('Error loading predictive insights:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Use fallback data for offline scenarios
      const fallbackInsights: PredictiveInsights = {
        demand_forecast: PredictiveAIService.getFallbackDemandPrediction(),
        optimal_pricing: PredictiveAIService.getFallbackPricePrediction(basePrice || 25),
        wait_time_estimate: PredictiveAIService.getFallbackWaitTimePrediction(),
        market_conditions: PredictiveAIService.getFallbackMarketConditions(),
        recommendations: PredictiveAIService.getFallbackRecommendations(),
      };
      
      setInsights(fallbackInsights);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInsights();
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  const renderDemandIndicator = () => {
    if (!insights) return null;

    const { demand_forecast } = insights;
    const demandLevel = PredictiveAIService.formatDemandLevel(demand_forecast.prediction);
    const demandColor = PredictiveAIService.getDemandColor(demand_forecast.prediction);

    return (
      <View style={styles.indicatorContainer}>
        <View style={styles.indicatorHeader}>
          <Ionicons name="trending-up" size={20} color={demandColor} />
          <Text style={styles.indicatorTitle}>Demand</Text>
        </View>
        <Text style={[styles.indicatorValue, { color: demandColor }]}>
          {demandLevel}
        </Text>
        <Text style={styles.indicatorSubtext}>
          {Math.round(demand_forecast.prediction)} rides expected
        </Text>
        <View style={styles.confidenceBar}>
          <View 
            style={[
              styles.confidenceFill, 
              { 
                width: `${demand_forecast.confidence * 100}%`,
                backgroundColor: PredictiveAIService.getConfidenceColor(demand_forecast.confidence)
              }
            ]} 
          />
        </View>
      </View>
    );
  };

  const renderPricingIndicator = () => {
    if (!insights || !basePrice) return null;

    const { optimal_pricing } = insights;
    const multiplier = optimal_pricing.prediction / basePrice;
    const priceImpact = PredictiveAIService.formatPriceImpact(multiplier);
    const priceColor = multiplier > 1.3 ? colors.error : multiplier > 1.1 ? colors.warning : colors.success;

    return (
      <View style={styles.indicatorContainer}>
        <View style={styles.indicatorHeader}>
          <MaterialIcon name="attach-money" size={20} color={priceColor} />
          <Text style={styles.indicatorTitle}>Pricing</Text>
        </View>
        <Text style={[styles.indicatorValue, { color: priceColor }]}>
          ${Math.round(optimal_pricing.prediction)}
        </Text>
        <Text style={styles.indicatorSubtext}>
          {priceImpact}
        </Text>
        <View style={styles.confidenceBar}>
          <View 
            style={[
              styles.confidenceFill, 
              { 
                width: `${optimal_pricing.confidence * 100}%`,
                backgroundColor: PredictiveAIService.getConfidenceColor(optimal_pricing.confidence)
              }
            ]} 
          />
        </View>
      </View>
    );
  };

  const renderWaitTimeIndicator = () => {
    if (!insights) return null;

    const { wait_time_estimate } = insights;
    const waitTimeText = PredictiveAIService.formatWaitTime(wait_time_estimate.prediction);
    const waitTimeColor = wait_time_estimate.prediction > 10 ? colors.error : 
                         wait_time_estimate.prediction > 5 ? colors.warning : colors.success;

    return (
      <View style={styles.indicatorContainer}>
        <View style={styles.indicatorHeader}>
          <Ionicons name="time" size={20} color={waitTimeColor} />
          <Text style={styles.indicatorTitle}>Wait Time</Text>
        </View>
        <Text style={[styles.indicatorValue, { color: waitTimeColor }]}>
          {Math.round(wait_time_estimate.prediction)}m
        </Text>
        <Text style={styles.indicatorSubtext}>
          {waitTimeText}
        </Text>
        <View style={styles.confidenceBar}>
          <View 
            style={[
              styles.confidenceFill, 
              { 
                width: `${wait_time_estimate.confidence * 100}%`,
                backgroundColor: PredictiveAIService.getConfidenceColor(wait_time_estimate.confidence)
              }
            ]} 
          />
        </View>
      </View>
    );
  };

  const renderMarketConditions = () => {
    if (!insights || !expanded) return null;

    const { market_conditions } = insights;

    return (
      <View style={styles.marketConditionsContainer}>
        <Text style={styles.sectionTitle}>Market Conditions</Text>
        
        <View style={styles.conditionsGrid}>
          {/* Weather */}
          <View style={styles.conditionItem}>
            <Ionicons 
              name={PredictiveAIService.getWeatherIcon(market_conditions.weather.condition)} 
              size={24} 
              color={colors.primary} 
            />
            <Text style={styles.conditionLabel}>Weather</Text>
            <Text style={styles.conditionValue}>
              {Math.round(market_conditions.weather.temperature)}°C
            </Text>
            <Text style={styles.conditionSubtext}>
              {market_conditions.weather.condition}
            </Text>
          </View>

          {/* Traffic */}
          <View style={styles.conditionItem}>
            <MaterialIcon 
              name={PredictiveAIService.getTrafficIcon(market_conditions.traffic.congestion_level)} 
              size={24} 
              color={colors.primary} 
            />
            <Text style={styles.conditionLabel}>Traffic</Text>
            <Text style={styles.conditionValue}>
              {market_conditions.traffic.congestion_level}
            </Text>
            <Text style={styles.conditionSubtext}>
              +{Math.round(market_conditions.traffic.estimated_delay)}m delay
            </Text>
          </View>

          {/* Events */}
          <View style={styles.conditionItem}>
            <MaterialIcon name="event" size={24} color={colors.primary} />
            <Text style={styles.conditionLabel}>Events</Text>
            <Text style={styles.conditionValue}>
              {market_conditions.events.count}
            </Text>
            <Text style={styles.conditionSubtext}>
              local events
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderRecommendations = () => {
    if (!insights || !expanded || insights.recommendations.length === 0) return null;

    return (
      <View style={styles.recommendationsContainer}>
        <Text style={styles.sectionTitle}>AI Recommendations</Text>
        {insights.recommendations.slice(0, 3).map((recommendation, index) => (
          <View key={index} style={styles.recommendationItem}>
            <MaterialIcon name="lightbulb" size={16} color={colors.warning} />
            <Text style={styles.recommendationText}>{recommendation}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderHeader = () => (
    <TouchableOpacity style={styles.header} onPress={toggleExpanded}>
      <View style={styles.headerLeft}>
        <MaterialIcon name="psychology" size={24} color={colors.primary} />
        <Text style={styles.headerTitle}>AI Insights</Text>
        {error && (
          <MaterialIcon name="wifi-off" size={16} color={colors.textSecondary} />
        )}
      </View>
      
      <View style={styles.headerRight}>
        {refreshing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
        <Ionicons 
          name={expanded ? "chevron-up" : "chevron-down"} 
          size={20} 
          color={colors.textSecondary} 
        />
      </View>
    </TouchableOpacity>
  );

  if (loading && !insights) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading AI insights...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {/* Always visible indicators */}
      <View style={styles.indicatorsRow}>
        {renderDemandIndicator()}
        {renderPricingIndicator()}
        {renderWaitTimeIndicator()}
      </View>

      {/* Expandable content */}
      <Animated.View style={[
        styles.expandableContent,
        {
          maxHeight: animatedHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 500],
          }),
          opacity: animatedHeight,
        }
      ]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {renderMarketConditions()}
          {renderRecommendations()}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    margin: spacing.sm,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.h3,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  loadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  indicatorsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  indicatorContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  indicatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  indicatorTitle: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  indicatorValue: {
    fontSize: typography.fontSize.title,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  indicatorSubtext: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  confidenceBar: {
    width: '100%',
    height: 3,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  expandableContent: {
    overflow: 'hidden',
  },
  marketConditionsContainer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  sectionTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  conditionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  conditionItem: {
    alignItems: 'center',
    flex: 1,
  },
  conditionLabel: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  conditionValue: {
    fontSize: typography.fontSize.body,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 2,
  },
  conditionSubtext: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  recommendationsContainer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  recommendationText: {
    fontSize: typography.fontSize.caption,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
});

export default PredictiveInsightsCard;