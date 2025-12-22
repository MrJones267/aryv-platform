/**
 * @fileoverview AI Recommendations screen with personalized travel suggestions
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import AIRecommendationsService, {
  RecommendationRequest,
  RecommendationsResponse,
  RecommendationContext,
} from '../../services/AIRecommendationsService';
import RecommendationsDisplay from '../../components/recommendations/RecommendationsDisplay';
import { locationService } from '../../services/LocationService';

interface RecommendationsScreenProps {
  navigation: any;
  route?: any;
}

const RecommendationsScreen: React.FC<RecommendationsScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { profile: user } = useAppSelector((state) => state.user);
  
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const getCurrentContext = (): RecommendationContext => {
    const now = new Date();
    return {
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      weather: 'clear', // Would be fetched from weather API
      urgency: 'low',
      budget: 'normal',
      purpose: 'other',
    };
  };

  const loadRecommendations = async () => {
    try {
      setIsLoading(true);
      
      // Get current location for location-based recommendations
      let currentLocation = null;
      try {
        currentLocation = await locationService.getCurrentLocation();
      } catch (locationError) {
        console.warn('Failed to get location for recommendations:', locationError);
        // Continue without location - recommendations will be less personalized
      }
      
      const request: RecommendationRequest = {
        userId: user?.id || 'user-1',
        context: getCurrentContext(),
        requestType: 'all',
        currentLocation: currentLocation ? {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        } : undefined,
      };

      const response = await AIRecommendationsService.getRecommendations(request);
      setRecommendations(response);
    } catch (error: any) {
      console.error('Failed to load recommendations:', error);
      Alert.alert(
        'Error',
        'Failed to load personalized recommendations. Please try again.',
        [
          { text: 'Retry', onPress: loadRecommendations },
          { text: 'Cancel' },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRecommendations();
    setRefreshing(false);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>AI Recommendations</Text>
          <Text style={styles.headerSubtitle}>
            Personalized suggestions to improve your rides
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {
            // Navigate to AI preferences/settings
            navigation.navigate('AISettings');
          }}
        >
          <Icon name="tune" size={24} color="#666666" />
        </TouchableOpacity>
      </View>
      
      {recommendations && (
        <View style={styles.headerStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{recommendations.recommendations.length}</Text>
            <Text style={styles.statLabel}>Active Suggestions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{recommendations.personalizedTips.length}</Text>
            <Text style={styles.statLabel}>Personal Tips</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {recommendations.userInsights ? recommendations.userInsights.travelFrequency : 'N/A'}
            </Text>
            <Text style={styles.statLabel}>Travel Frequency</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <Icon name="auto-awesome" size={48} color="#2196F3" />
      <Text style={styles.loadingText}>Analyzing your travel patterns...</Text>
      <Text style={styles.loadingSubtext}>
        Our AI is preparing personalized recommendations for you
      </Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Icon name="error-outline" size={48} color="#F44336" />
      <Text style={styles.errorText}>Unable to load recommendations</Text>
      <Text style={styles.errorSubtext}>
        Please check your connection and try again
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadRecommendations}>
        <Icon name="refresh" size={20} color="#FFFFFF" />
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      {isLoading ? (
        renderLoadingState()
      ) : !recommendations ? (
        renderErrorState()
      ) : (
        <RecommendationsDisplay
          recommendations={recommendations.recommendations}
          userInsights={recommendations.userInsights}
          trendingPatterns={recommendations.trendingPatterns}
          personalizedTips={recommendations.personalizedTips}
          style={styles.recommendationsContainer}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E0E0E0',
  },
  recommendationsContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default RecommendationsScreen;