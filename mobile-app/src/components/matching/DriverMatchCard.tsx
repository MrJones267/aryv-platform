/**
 * @fileoverview Driver match card with AI compatibility scoring
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { DriverMatch, CompatibilityFactor } from '../../services/AIMatchingService';

interface DriverMatchCardProps {
  match: DriverMatch;
  onSelect: (match: DriverMatch) => void;
  onMessage?: (driverId: string) => void;
  style?: any;
}

export const DriverMatchCard: React.FC<DriverMatchCardProps> = ({
  match,
  onSelect,
  onMessage,
  style,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getCompatibilityColor = (score: number): string => {
    if (score >= 0.85) return '#4CAF50';
    if (score >= 0.70) return '#8BC34A';
    if (score >= 0.55) return '#FF9800';
    if (score >= 0.40) return '#FF5722';
    return '#F44336';
  };

  const getCompatibilityLabel = (score: number): string => {
    if (score >= 0.85) return 'Excellent';
    if (score >= 0.70) return 'Good';
    if (score >= 0.55) return 'Fair';
    if (score >= 0.40) return 'Poor';
    return 'Very Poor';
  };

  const renderRankBadge = () => {
    if (match.rank <= 3) {
      const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
      const icons = ['emoji-events', 'workspace-premium', 'workspace-premium'];
      
      return (
        <View style={[styles.rankBadge, { backgroundColor: colors[match.rank - 1] }]}>
          <Icon name={icons[match.rank - 1]} size={16} color="#FFFFFF" />
          <Text style={styles.rankText}>{match.rank}</Text>
        </View>
      );
    }
    
    return (
      <View style={[styles.rankBadge, styles.normalRank]}>
        <Text style={styles.rankTextNormal}>#{match.rank}</Text>
      </View>
    );
  };

  const renderCompatibilityScore = () => {
    const { overall } = match.compatibility;
    const color = getCompatibilityColor(overall);
    const percentage = Math.round(overall * 100);
    
    return (
      <View style={styles.compatibilityContainer}>
        <View style={[styles.compatibilityCircle, { borderColor: color }]}>
          <Text style={[styles.compatibilityPercent, { color }]}>
            {percentage}%
          </Text>
        </View>
        <Text style={styles.compatibilityLabel}>
          {getCompatibilityLabel(overall)} Match
        </Text>
      </View>
    );
  };

  const renderDriverInfo = () => {
    const { driver, vehicle } = match;
    
    return (
      <View style={styles.driverSection}>
        <View style={styles.avatarContainer}>
          {driver.profileImage ? (
            <Image source={{ uri: driver.profileImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {driver.firstName[0]}{driver.lastName[0]}
              </Text>
            </View>
          )}
          {driver.verified && (
            <View style={styles.verifiedBadge}>
              <Icon name="verified" size={16} color="#2196F3" />
            </View>
          )}
        </View>
        
        <View style={styles.driverDetails}>
          <Text style={styles.driverName}>
            {driver.firstName} {driver.lastName}
          </Text>
          <View style={styles.driverRating}>
            <Icon name="star" size={16} color="#FF9800" />
            <Text style={styles.ratingText}>{driver.rating.toFixed(1)}</Text>
            <Text style={styles.ridesText}>• {driver.totalRides} rides</Text>
          </View>
          <Text style={styles.vehicleInfo}>
            {vehicle.year} {vehicle.make} {vehicle.model} • {vehicle.color}
          </Text>
        </View>
        
        <View style={styles.actionButtons}>
          {onMessage && (
            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => onMessage(driver.id)}
            >
              <Icon name="message" size={20} color="#2196F3" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderTripInfo = () => {
    return (
      <View style={styles.tripSection}>
        <View style={styles.tripInfo}>
          <Icon name="schedule" size={16} color="#666666" />
          <Text style={styles.tripText}>{match.estimatedArrival} min away</Text>
        </View>
        <View style={styles.tripInfo}>
          <Icon name="attach-money" size={16} color="#666666" />
          <Text style={styles.tripText}>${match.pricing.finalPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.tripInfo}>
          <Icon name="airline-seat-recline-normal" size={16} color="#666666" />
          <Text style={styles.tripText}>{match.availability.availableSeats} seats</Text>
        </View>
      </View>
    );
  };

  const renderCompatibilityFactors = () => {
    const topFactors = match.compatibility.factors
      .filter(factor => factor.impact === 'positive')
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (topFactors.length === 0) return null;

    return (
      <View style={styles.factorsSection}>
        <Text style={styles.factorsTitle}>Why this is a good match:</Text>
        {topFactors.map((factor, index) => (
          <View key={index} style={styles.factorItem}>
            <Icon 
              name="check-circle" 
              size={14} 
              color={getCompatibilityColor(factor.score)} 
            />
            <Text style={styles.factorText}>{factor.description}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderDetailsModal = () => {
    return (
      <Modal
        visible={showDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Compatibility Details</Text>
            <TouchableOpacity onPress={() => setShowDetails(false)}>
              <Icon name="close" size={24} color="#333333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {/* Overall Score */}
            <View style={styles.overallScoreSection}>
              <Text style={styles.sectionTitle}>Overall Compatibility</Text>
              <View style={styles.overallScoreContainer}>
                <View style={[styles.largeCompatibilityCircle, { borderColor: getCompatibilityColor(match.compatibility.overall) }]}>
                  <Text style={[styles.largeCompatibilityPercent, { color: getCompatibilityColor(match.compatibility.overall) }]}>
                    {Math.round(match.compatibility.overall * 100)}%
                  </Text>
                </View>
                <View style={styles.overallScoreDetails}>
                  <Text style={styles.overallScoreLabel}>
                    {getCompatibilityLabel(match.compatibility.overall)} Match
                  </Text>
                  <Text style={styles.confidenceText}>
                    {Math.round(match.confidence * 100)}% AI Confidence
                  </Text>
                </View>
              </View>
            </View>

            {/* Breakdown Scores */}
            <View style={styles.breakdownSection}>
              <Text style={styles.sectionTitle}>Compatibility Breakdown</Text>
              {Object.entries(match.compatibility.breakdown).map(([category, score]) => (
                <View key={category} style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Text>
                  <View style={styles.scoreBarContainer}>
                    <View 
                      style={[
                        styles.scoreBar, 
                        { width: `${score * 100}%`, backgroundColor: getCompatibilityColor(score) }
                      ]} 
                    />
                  </View>
                  <Text style={styles.breakdownScore}>{Math.round(score * 100)}%</Text>
                </View>
              ))}
            </View>

            {/* Detailed Factors */}
            <View style={styles.factorsDetailSection}>
              <Text style={styles.sectionTitle}>Compatibility Factors</Text>
              {match.compatibility.factors.map((factor, index) => (
                <View key={index} style={styles.factorDetailItem}>
                  <View style={styles.factorHeader}>
                    <Icon 
                      name={factor.impact === 'positive' ? 'check-circle' : 
                            factor.impact === 'negative' ? 'cancel' : 'radio-button-unchecked'} 
                      size={16} 
                      color={factor.impact === 'positive' ? '#4CAF50' : 
                            factor.impact === 'negative' ? '#F44336' : '#9E9E9E'} 
                    />
                    <Text style={styles.factorCategory}>
                      {factor.category.charAt(0).toUpperCase() + factor.category.slice(1)}
                    </Text>
                    <Text style={styles.factorScore}>
                      {Math.round(factor.score * 100)}%
                    </Text>
                  </View>
                  <Text style={styles.factorDescription}>
                    {factor.description}
                  </Text>
                </View>
              ))}
            </View>

            {/* Driver Preferences */}
            <View style={styles.preferencesSection}>
              <Text style={styles.sectionTitle}>Driver Preferences</Text>
              <View style={styles.preferencesList}>
                <View style={styles.preferenceItem}>
                  <Icon name="smoke-free" size={20} color="#666666" />
                  <Text style={styles.preferenceText}>
                    {match.driver.preferences.smokingPolicy === 'prohibited' ? 'No Smoking' :
                     match.driver.preferences.smokingPolicy === 'outdoor_only' ? 'Outdoor Smoking Only' :
                     'Smoking Allowed'}
                  </Text>
                </View>
                
                <View style={styles.preferenceItem}>
                  <Icon name="music-note" size={20} color="#666666" />
                  <Text style={styles.preferenceText}>
                    {match.driver.preferences.musicPolicy === 'driver_choice' ? 'Driver Chooses Music' :
                     match.driver.preferences.musicPolicy === 'passenger_choice' ? 'Passenger Chooses Music' :
                     'Music by Agreement'}
                  </Text>
                </View>
                
                <View style={styles.preferenceItem}>
                  <Icon name="chat" size={20} color="#666666" />
                  <Text style={styles.preferenceText}>
                    {match.driver.preferences.conversationStyle.charAt(0).toUpperCase() + 
                     match.driver.preferences.conversationStyle.slice(1)} conversation
                  </Text>
                </View>
                
                <View style={styles.preferenceItem}>
                  <Icon name="pets" size={20} color="#666666" />
                  <Text style={styles.preferenceText}>
                    {match.driver.preferences.petsPolicy === 'none' ? 'No Pets' :
                     match.driver.preferences.petsPolicy === 'small_only' ? 'Small Pets Only' :
                     match.driver.preferences.petsPolicy === 'medium_allowed' ? 'Small/Medium Pets' :
                     'All Pets Welcome'}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <TouchableOpacity style={[styles.container, style]} onPress={() => onSelect(match)}>
        <View style={styles.header}>
          {renderRankBadge()}
          {renderCompatibilityScore()}
        </View>
        
        {renderDriverInfo()}
        {renderTripInfo()}
        {renderCompatibilityFactors()}
        
        <TouchableOpacity 
          style={styles.detailsButton}
          onPress={(e) => {
            e.stopPropagation();
            setShowDetails(true);
          }}
        >
          <Text style={styles.detailsButtonText}>View Compatibility Details</Text>
          <Icon name="chevron-right" size={16} color="#2196F3" />
        </TouchableOpacity>
      </TouchableOpacity>
      
      {renderDetailsModal()}
    </>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  normalRank: {
    backgroundColor: '#E0E0E0',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rankTextNormal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  compatibilityContainer: {
    alignItems: 'center',
    gap: 4,
  },
  compatibilityCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compatibilityPercent: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  compatibilityLabel: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 1,
  },
  driverDetails: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  ridesText: {
    fontSize: 12,
    color: '#666666',
  },
  vehicleInfo: {
    fontSize: 12,
    color: '#666666',
  },
  actionButtons: {
    gap: 8,
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripText: {
    fontSize: 12,
    color: '#666666',
  },
  factorsSection: {
    marginBottom: 12,
  },
  factorsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  factorText: {
    fontSize: 11,
    color: '#666666',
    flex: 1,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  detailsButtonText: {
    fontSize: 12,
    color: '#2196F3',
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
  overallScoreSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  overallScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  largeCompatibilityCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeCompatibilityPercent: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  overallScoreDetails: {
    flex: 1,
  },
  overallScoreLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 14,
    color: '#666666',
  },
  breakdownSection: {
    marginBottom: 24,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#333333',
    width: 80,
  },
  scoreBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBar: {
    height: '100%',
    borderRadius: 4,
  },
  breakdownScore: {
    fontSize: 12,
    color: '#666666',
    width: 40,
    textAlign: 'right',
  },
  factorsDetailSection: {
    marginBottom: 24,
  },
  factorDetailItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  factorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  factorCategory: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    flex: 1,
  },
  factorScore: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  factorDescription: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 24,
  },
  preferencesSection: {
    marginBottom: 24,
  },
  preferencesList: {
    gap: 12,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preferenceText: {
    fontSize: 14,
    color: '#333333',
  },
});

export default DriverMatchCard;