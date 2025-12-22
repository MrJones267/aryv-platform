/**
 * @fileoverview AI Pricing display component with detailed breakdown
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PricingResponse, AlternativePricing, SurgeZone } from '../../services/AIPricingService';

interface PricingDisplayProps {
  pricing: PricingResponse | null;
  isLoading: boolean;
  alternatives?: AlternativePricing[];
  surgeZones?: SurgeZone[];
  onSelectAlternative?: (alternative: AlternativePricing) => void;
  onRefresh?: () => void;
  showBreakdown?: boolean;
  style?: any;
}

export const PricingDisplay: React.FC<PricingDisplayProps> = ({
  pricing,
  isLoading,
  alternatives,
  surgeZones,
  onSelectAlternative,
  onRefresh,
  showBreakdown = true,
  style,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (isLoading) {
      // Pulse animation while loading
      const pulse = Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]);
      
      Animated.loop(pulse).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLoading, pulseAnim]);

  const renderLoadingState = () => (
    <Animated.View style={[styles.container, { opacity: pulseAnim }, style]}>
      <View style={styles.loadingContainer}>
        <Icon name="calculate" size={32} color="#2196F3" />
        <Text style={styles.loadingText}>AI is calculating optimal pricing...</Text>
        <Text style={styles.loadingSubtext}>
          Analyzing demand, traffic, weather, and route complexity
        </Text>
      </View>
    </Animated.View>
  );

  const renderSurgeIndicator = () => {
    if (!pricing || pricing.surgeFactor <= 1.2) return null;
    
    const surgeLevel = pricing.surgeFactor < 1.5 ? 'low' : pricing.surgeFactor < 2.0 ? 'medium' : 'high';
    const surgeColor = surgeLevel === 'low' ? '#FF9800' : surgeLevel === 'medium' ? '#F44336' : '#9C27B0';
    
    return (
      <View style={[styles.surgeIndicator, { backgroundColor: surgeColor }]}>
        <Icon name="trending-up" size={16} color="#FFFFFF" />
        <Text style={styles.surgeText}>
          {pricing.surgeFactor.toFixed(1)}x Surge
        </Text>
      </View>
    );
  };

  const renderConfidenceIndicator = () => {
    if (!pricing) return null;
    
    const confidence = pricing.confidence;
    const confidenceColor = confidence > 0.8 ? '#4CAF50' : confidence > 0.6 ? '#FF9800' : '#F44336';
    const confidenceText = confidence > 0.8 ? 'High' : confidence > 0.6 ? 'Medium' : 'Low';
    
    return (
      <View style={styles.confidenceContainer}>
        <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
        <Text style={styles.confidenceText}>{confidenceText} Confidence</Text>
      </View>
    );
  };

  const renderMainPrice = () => {
    if (!pricing) return null;
    
    return (
      <View style={styles.priceContainer}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Estimated Total</Text>
          {renderSurgeIndicator()}
        </View>
        
        <View style={styles.mainPriceRow}>
          <Text style={styles.finalPrice}>
            ${pricing.finalPrice.toFixed(2)}
          </Text>
          <View style={styles.priceDetails}>
            <Text style={styles.currency}>{pricing.currency}</Text>
            {renderConfidenceIndicator()}
          </View>
        </View>
        
        <View style={styles.tripDetails}>
          <View style={styles.tripDetail}>
            <Icon name="schedule" size={16} color="#666666" />
            <Text style={styles.tripDetailText}>
              ~{pricing.estimatedDuration} min
            </Text>
          </View>
          <View style={styles.tripDetail}>
            <Icon name="straighten" size={16} color="#666666" />
            <Text style={styles.tripDetailText}>
              {pricing.estimatedDistance.toFixed(1)} km
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFactorsCard = () => {
    if (!pricing) return null;
    
    const { factors } = pricing;
    
    return (
      <View style={styles.factorsCard}>
        <Text style={styles.factorsTitle}>Pricing Factors</Text>
        
        <View style={styles.factorRow}>
          <View style={styles.factorItem}>
            <Icon name="people" size={20} color="#2196F3" />
            <Text style={styles.factorLabel}>Demand</Text>
            <Text style={[styles.factorValue, { color: getDemandColor(factors.demand.level) }]}>
              {factors.demand.level.charAt(0).toUpperCase() + factors.demand.level.slice(1)}
            </Text>
          </View>
          
          <View style={styles.factorItem}>
            <Icon name="traffic" size={20} color="#FF9800" />
            <Text style={styles.factorLabel}>Traffic</Text>
            <Text style={[styles.factorValue, { color: getTrafficColor(factors.traffic.level) }]}>
              {factors.traffic.level.charAt(0).toUpperCase() + factors.traffic.level.slice(1)}
            </Text>
          </View>
        </View>
        
        <View style={styles.factorRow}>
          <View style={styles.factorItem}>
            <Icon name="wb-cloudy" size={20} color="#607D8B" />
            <Text style={styles.factorLabel}>Weather</Text>
            <Text style={[styles.factorValue, { color: getWeatherColor(factors.weather.impact) }]}>
              {factors.weather.impact.charAt(0).toUpperCase() + factors.weather.impact.slice(1)} Impact
            </Text>
          </View>
          
          <View style={styles.factorItem}>
            <Icon name="route" size={20} color="#9C27B0" />
            <Text style={styles.factorLabel}>Route</Text>
            <Text style={styles.factorValue}>
              {factors.route.complexity.charAt(0).toUpperCase() + factors.route.complexity.slice(1)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderAlternativesButton = () => {
    if (!alternatives || alternatives.length === 0) return null;
    
    return (
      <TouchableOpacity 
        style={styles.alternativesButton}
        onPress={() => setShowAlternatives(true)}
      >
        <Icon name="compare-arrows" size={20} color="#2196F3" />
        <Text style={styles.alternativesButtonText}>
          View {alternatives.length} Alternative{alternatives.length > 1 ? 's' : ''}
        </Text>
        <Icon name="chevron-right" size={20} color="#2196F3" />
      </TouchableOpacity>
    );
  };

  const renderBreakdownButton = () => {
    if (!pricing || !showBreakdown) return null;
    
    return (
      <TouchableOpacity 
        style={styles.breakdownButton}
        onPress={() => setShowDetails(true)}
      >
        <Icon name="receipt" size={20} color="#666666" />
        <Text style={styles.breakdownButtonText}>View Price Breakdown</Text>
      </TouchableOpacity>
    );
  };

  const renderBreakdownModal = () => {
    if (!pricing) return null;
    
    const { breakdown } = pricing;
    
    return (
      <Modal
        visible={showDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Price Breakdown</Text>
            <TouchableOpacity onPress={() => setShowDetails(false)}>
              <Icon name="close" size={24} color="#333333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.breakdownSection}>
              <Text style={styles.sectionTitle}>Base Fare Components</Text>
              
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Base Fare</Text>
                <Text style={styles.breakdownValue}>
                  ${breakdown.baseFare.toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Distance ({pricing.estimatedDistance.toFixed(1)} km)</Text>
                <Text style={styles.breakdownValue}>
                  ${breakdown.distanceFare.toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Time ({pricing.estimatedDuration} min)</Text>
                <Text style={styles.breakdownValue}>
                  ${breakdown.timeFare.toFixed(2)}
                </Text>
              </View>
            </View>
            
            <View style={styles.breakdownSection}>
              <Text style={styles.sectionTitle}>AI Adjustments</Text>
              
              {breakdown.demandAdjustment > 0 && (
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Demand Adjustment</Text>
                  <Text style={[styles.breakdownValue, { color: '#F44336' }]}>
                    +${breakdown.demandAdjustment.toFixed(2)}
                  </Text>
                </View>
              )}
              
              {breakdown.trafficAdjustment > 0 && (
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Traffic Adjustment</Text>
                  <Text style={[styles.breakdownValue, { color: '#F44336' }]}>
                    +${breakdown.trafficAdjustment.toFixed(2)}
                  </Text>
                </View>
              )}
              
              {breakdown.weatherAdjustment > 0 && (
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Weather Adjustment</Text>
                  <Text style={[styles.breakdownValue, { color: '#F44336' }]}>
                    +${breakdown.weatherAdjustment.toFixed(2)}
                  </Text>
                </View>
              )}
              
              {breakdown.surgeMultiplier > 0 && (
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Surge Pricing</Text>
                  <Text style={[styles.breakdownValue, { color: '#F44336' }]}>
                    +${breakdown.surgeMultiplier.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.breakdownSection}>
              <Text style={styles.sectionTitle}>Additional Charges</Text>
              
              {breakdown.tolls && (
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Tolls</Text>
                  <Text style={styles.breakdownValue}>
                    ${breakdown.tolls.toFixed(2)}
                  </Text>
                </View>
              )}
              
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Platform Fee</Text>
                <Text style={styles.breakdownValue}>
                  ${breakdown.fees.toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Taxes</Text>
                <Text style={styles.breakdownValue}>
                  ${breakdown.taxes.toFixed(2)}
                </Text>
              </View>
              
              {breakdown.discount && (
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Discount</Text>
                  <Text style={[styles.breakdownValue, { color: '#4CAF50' }]}>
                    -${breakdown.discount.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={[styles.breakdownItem, styles.totalItem]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                ${pricing.finalPrice.toFixed(2)}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderAlternativesModal = () => {
    if (!alternatives) return null;
    
    return (
      <Modal
        visible={showAlternatives}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAlternatives(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Alternative Options</Text>
            <TouchableOpacity onPress={() => setShowAlternatives(false)}>
              <Icon name="close" size={24} color="#333333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {alternatives.map((alternative, index) => (
              <TouchableOpacity
                key={index}
                style={styles.alternativeItem}
                onPress={() => {
                  setShowAlternatives(false);
                  onSelectAlternative?.(alternative);
                }}
              >
                <View style={styles.alternativeHeader}>
                  <View>
                    <Text style={styles.alternativeTitle}>
                      {alternative.rideType.charAt(0).toUpperCase() + alternative.rideType.slice(1)}
                    </Text>
                    <Text style={styles.alternativeDescription}>
                      {alternative.description}
                    </Text>
                  </View>
                  <View style={styles.alternativePrice}>
                    <Text style={styles.alternativePriceText}>
                      ${alternative.price.toFixed(2)}
                    </Text>
                    <Text style={styles.alternativeWait}>
                      ~{alternative.estimatedWaitTime} min
                    </Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={20} color="#CCCCCC" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // Helper functions
  const getDemandColor = (level: string) => {
    switch (level) {
      case 'very_high': return '#9C27B0';
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      default: return '#4CAF50';
    }
  };

  const getTrafficColor = (level: string) => {
    switch (level) {
      case 'severe': return '#9C27B0';
      case 'heavy': return '#F44336';
      case 'moderate': return '#FF9800';
      default: return '#4CAF50';
    }
  };

  const getWeatherColor = (impact: string) => {
    switch (impact) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#FF9800';
      default: return '#4CAF50';
    }
  };

  if (isLoading) {
    return renderLoadingState();
  }

  if (!pricing) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={32} color="#F44336" />
          <Text style={styles.errorText}>Unable to calculate pricing</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {renderMainPrice()}
      {renderFactorsCard()}
      {renderAlternativesButton()}
      {renderBreakdownButton()}
      
      {renderBreakdownModal()}
      {renderAlternativesModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginTop: 12,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    marginTop: 12,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  priceContainer: {
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666666',
  },
  surgeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  surgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mainPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  finalPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
  },
  priceDetails: {
    alignItems: 'flex-end',
  },
  currency: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 4,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: '#666666',
  },
  tripDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  tripDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripDetailText: {
    fontSize: 12,
    color: '#666666',
  },
  factorsCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  factorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  factorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  factorItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  factorLabel: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
  },
  factorValue: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  alternativesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  alternativesButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    marginLeft: 8,
  },
  breakdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  breakdownButtonText: {
    fontSize: 12,
    color: '#666666',
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
  breakdownSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  totalItem: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: '#2196F3',
    paddingTop: 16,
    marginTop: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  alternativeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  alternativeHeader: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alternativeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  alternativeDescription: {
    fontSize: 12,
    color: '#666666',
  },
  alternativePrice: {
    alignItems: 'flex-end',
  },
  alternativePriceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  alternativeWait: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
});

export default PricingDisplay;