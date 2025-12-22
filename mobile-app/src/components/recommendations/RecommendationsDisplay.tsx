/**
 * @fileoverview AI recommendations display component with personalized suggestions
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { 
  AIRecommendation, 
  RouteRecommendation, 
  DriverRecommendation, 
  TimingRecommendation, 
  PriceRecommendation,
  UserInsights,
  TrendingPattern,
  PersonalizedTip 
} from '../../services/AIRecommendationsService';

interface RecommendationsDisplayProps {
  recommendations: AIRecommendation[];
  userInsights?: UserInsights;
  trendingPatterns?: TrendingPattern[];
  personalizedTips?: PersonalizedTip[];
  style?: any;
}

export const RecommendationsDisplay: React.FC<RecommendationsDisplayProps> = ({
  recommendations,
  userInsights,
  trendingPatterns,
  personalizedTips,
  style,
}) => {
  const [selectedRecommendation, setSelectedRecommendation] = useState<AIRecommendation | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'insights' | 'tips'>('recommendations');

  const getRecommendationIcon = (type: string, category: string): string => {
    switch (type) {
      case 'route':
        return 'route';
      case 'driver':
        return 'person';
      case 'timing':
        return 'schedule';
      case 'price':
        return 'attach-money';
      default:
        return 'lightbulb-outline';
    }
  };

  const getRecommendationColor = (impact: string): string => {
    switch (impact) {
      case 'high':
        return '#4CAF50';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#2196F3';
      default:
        return '#9E9E9E';
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#4CAF50';
    if (confidence >= 0.6) return '#8BC34A';
    if (confidence >= 0.4) return '#FF9800';
    return '#F44336';
  };

  const renderRecommendationCard = (recommendation: AIRecommendation) => {
    const icon = getRecommendationIcon(recommendation.type, recommendation.category);
    const impactColor = getRecommendationColor(recommendation.impact);
    const confidenceColor = getConfidenceColor(recommendation.confidence);

    return (
      <TouchableOpacity
        key={recommendation.id}
        style={styles.recommendationCard}
        onPress={() => setSelectedRecommendation(recommendation)}
      >
        <View style={styles.recommendationHeader}>
          <View style={styles.recommendationIconContainer}>
            <Icon name={icon} size={24} color={impactColor} />
          </View>
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
            <Text style={styles.recommendationDescription} numberOfLines={2}>
              {recommendation.description}
            </Text>
          </View>
          <View style={styles.recommendationMeta}>
            <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor }]}>
              <Text style={styles.confidenceText}>
                {Math.round(recommendation.confidence * 100)}%
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color="#CCCCCC" />
          </View>
        </View>

        {recommendation.actionable && (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: impactColor }]}
              onPress={(e) => {
                e.stopPropagation();
                // Handle specific actions based on recommendation type
                console.log('Acting on recommendation:', recommendation.id);
              }}
            >
              <Icon name="touch-app" size={16} color={impactColor} />
              <Text style={[styles.actionText, { color: impactColor }]}>Take Action</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderUserInsights = () => {
    if (!userInsights) return null;

    return (
      <View style={styles.insightsContainer}>
        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>Your Travel Profile</Text>
          <View style={styles.insightRow}>
            <Icon name="timeline" size={20} color="#666666" />
            <Text style={styles.insightText}>
              Travel Frequency: {userInsights.travelFrequency}
            </Text>
          </View>
          <View style={styles.insightRow}>
            <Icon name="attach-money" size={20} color="#666666" />
            <Text style={styles.insightText}>
              Average Spend: ${userInsights.averageSpend}/ride
            </Text>
          </View>
          <View style={styles.insightRow}>
            <Icon name="schedule" size={20} color="#666666" />
            <Text style={styles.insightText}>
              Preferred Times: {userInsights.preferredTimes.join(', ')}
            </Text>
          </View>
          <View style={styles.insightRow}>
            <Icon name="route" size={20} color="#666666" />
            <Text style={styles.insightText}>
              Top Routes: {userInsights.topRoutes.join(', ')}
            </Text>
          </View>
        </View>

        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>Behavior Trends</Text>
          {userInsights.behaviorTrends.map((trend, index) => (
            <View key={index} style={styles.trendItem}>
              <Icon name="trending-up" size={16} color="#4CAF50" />
              <Text style={styles.trendText}>{trend}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderPersonalizedTips = () => {
    if (!personalizedTips || personalizedTips.length === 0) return null;

    return (
      <View style={styles.tipsContainer}>
        {personalizedTips.map((tip, index) => {
          const categoryIcons = {
            savings: 'savings',
            efficiency: 'flash-on',
            comfort: 'airline-seat-recline-extra',
            safety: 'security',
          };

          return (
            <View key={index} style={styles.tipCard}>
              <View style={styles.tipHeader}>
                <Icon 
                  name={categoryIcons[tip.category]} 
                  size={20} 
                  color="#2196F3" 
                />
                <Text style={styles.tipCategory}>
                  {tip.category.charAt(0).toUpperCase() + tip.category.slice(1)}
                </Text>
              </View>
              <Text style={styles.tipText}>{tip.tip}</Text>
              <Text style={styles.tipBenefit}>💡 {tip.estimatedBenefit}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderDetailModal = () => {
    if (!selectedRecommendation) return null;

    return (
      <Modal
        visible={!!selectedRecommendation}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedRecommendation(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Recommendation Details</Text>
            <TouchableOpacity onPress={() => setSelectedRecommendation(null)}>
              <Icon name="close" size={24} color="#333333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.modalRecommendationHeader}>
              <Icon 
                name={getRecommendationIcon(selectedRecommendation.type, selectedRecommendation.category)} 
                size={32} 
                color={getRecommendationColor(selectedRecommendation.impact)} 
              />
              <View style={styles.modalRecommendationInfo}>
                <Text style={styles.modalRecommendationTitle}>
                  {selectedRecommendation.title}
                </Text>
                <Text style={styles.modalRecommendationCategory}>
                  {selectedRecommendation.category.replace('_', ' ')}
                </Text>
              </View>
            </View>

            <View style={styles.modalConfidenceContainer}>
              <View style={styles.confidenceRow}>
                <Text style={styles.confidenceLabel}>AI Confidence:</Text>
                <View style={[styles.largeBadge, { backgroundColor: getConfidenceColor(selectedRecommendation.confidence) }]}>
                  <Text style={styles.largeConfidenceText}>
                    {Math.round(selectedRecommendation.confidence * 100)}%
                  </Text>
                </View>
              </View>
              <View style={styles.impactRow}>
                <Text style={styles.impactLabel}>Expected Impact:</Text>
                <Text style={[styles.impactValue, { color: getRecommendationColor(selectedRecommendation.impact) }]}>
                  {selectedRecommendation.impact.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descriptionText}>
                {selectedRecommendation.description}
              </Text>
            </View>

            <View style={styles.reasoningSection}>
              <Text style={styles.sectionTitle}>Why We Recommend This</Text>
              {selectedRecommendation.reasoning.map((reason, index) => (
                <View key={index} style={styles.reasonItem}>
                  <Icon name="check-circle" size={16} color="#4CAF50" />
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ))}
            </View>

            {/* Render specific data based on recommendation type */}
            {selectedRecommendation.type === 'route' && (
              <View style={styles.specificDataSection}>
                <Text style={styles.sectionTitle}>Route Details</Text>
                {/* Would render route-specific data from RouteRecommendation.data */}
              </View>
            )}

            {selectedRecommendation.actionable && (
              <View style={styles.actionSection}>
                <TouchableOpacity 
                  style={[styles.primaryActionButton, { backgroundColor: getRecommendationColor(selectedRecommendation.impact) }]}
                  onPress={() => {
                    // Handle action
                    setSelectedRecommendation(null);
                  }}
                >
                  <Icon name="touch-app" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>Apply Recommendation</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recommendations' && styles.activeTab]}
          onPress={() => setActiveTab('recommendations')}
        >
          <Icon 
            name="lightbulb-outline" 
            size={20} 
            color={activeTab === 'recommendations' ? '#2196F3' : '#666666'} 
          />
          <Text style={[styles.tabText, activeTab === 'recommendations' && styles.activeTabText]}>
            Recommendations
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'insights' && styles.activeTab]}
          onPress={() => setActiveTab('insights')}
        >
          <Icon 
            name="insights" 
            size={20} 
            color={activeTab === 'insights' ? '#2196F3' : '#666666'} 
          />
          <Text style={[styles.tabText, activeTab === 'insights' && styles.activeTabText]}>
            Insights
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tips' && styles.activeTab]}
          onPress={() => setActiveTab('tips')}
        >
          <Icon 
            name="tips-and-updates" 
            size={20} 
            color={activeTab === 'tips' ? '#2196F3' : '#666666'} 
          />
          <Text style={[styles.tabText, activeTab === 'tips' && styles.activeTabText]}>
            Tips
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'recommendations' && (
          <View style={styles.recommendationsContainer}>
            {recommendations.length > 0 ? (
              recommendations.map(renderRecommendationCard)
            ) : (
              <View style={styles.emptyState}>
                <Icon name="lightbulb-outline" size={48} color="#CCCCCC" />
                <Text style={styles.emptyStateText}>No recommendations available</Text>
                <Text style={styles.emptyStateSubtext}>
                  Take more rides to get personalized suggestions
                </Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'insights' && renderUserInsights()}
        {activeTab === 'tips' && renderPersonalizedTips()}
      </ScrollView>

      {renderDetailModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2196F3',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  recommendationsContainer: {
    gap: 12,
  },
  recommendationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  recommendationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  recommendationMeta: {
    alignItems: 'center',
    gap: 8,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 20,
    gap: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
  },
  insightsContainer: {
    gap: 16,
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  trendText: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  tipsContainer: {
    gap: 12,
  },
  tipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tipCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  tipText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    marginBottom: 8,
  },
  tipBenefit: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalRecommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  modalRecommendationInfo: {
    flex: 1,
  },
  modalRecommendationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  modalRecommendationCategory: {
    fontSize: 14,
    color: '#666666',
    textTransform: 'capitalize',
  },
  modalConfidenceContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#666666',
  },
  largeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  largeConfidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  impactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  impactLabel: {
    fontSize: 14,
    color: '#666666',
  },
  impactValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  descriptionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  reasoningSection: {
    marginBottom: 20,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
    lineHeight: 20,
  },
  specificDataSection: {
    marginBottom: 20,
  },
  actionSection: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default RecommendationsDisplay;