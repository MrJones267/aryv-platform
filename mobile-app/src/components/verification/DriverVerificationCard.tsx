/**
 * @fileoverview Driver verification card showing verified driver info, vehicle, and safety badges
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';

interface DriverInfo {
  id: string;
  firstName: string;
  lastName: string;
  rating: number;
  totalRides: number;
  profileImage?: string;
  isVerified?: boolean;
  verificationLevel?: 'basic' | 'enhanced' | 'full';
  memberSince?: string;
}

interface VehicleInfo {
  make: string;
  model: string;
  year?: number;
  color: string;
  licensePlate: string;
  photo?: string;
  isInspected?: boolean;
}

interface DriverVerificationCardProps {
  driver: DriverInfo;
  vehicle?: VehicleInfo;
  compact?: boolean;
  onPress?: () => void;
  onContactPress?: () => void;
  onCallPress?: () => void;
}

const DriverVerificationCard: React.FC<DriverVerificationCardProps> = ({
  driver,
  vehicle,
  compact = false,
  onPress,
  onContactPress,
  onCallPress,
}) => {
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Icon key={i} name="star" size={14} color="#F59E0B" />);
      } else if (i === fullStars && hasHalf) {
        stars.push(<Icon key={i} name="star-half" size={14} color="#F59E0B" />);
      } else {
        stars.push(<Icon key={i} name="star-border" size={14} color="#D1D5DB" />);
      }
    }
    return stars;
  };

  const getVerificationBadge = () => {
    if (!driver.isVerified) return null;

    const level = driver.verificationLevel || 'basic';
    const badgeConfig = {
      basic: { icon: 'verified-user', color: '#6B7280', label: 'ID Verified' },
      enhanced: { icon: 'verified-user', color: '#2563EB', label: 'Enhanced Verified' },
      full: { icon: 'verified-user', color: '#10B981', label: 'Fully Verified' },
    };

    const badge = badgeConfig[level];
    return (
      <View style={[styles.verificationBadge, { backgroundColor: badge.color + '15' }]}>
        <Icon name={badge.icon} size={12} color={badge.color} />
        <Text style={[styles.verificationText, { color: badge.color }]}>
          {badge.label}
        </Text>
      </View>
    );
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactCard}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        <View style={styles.compactAvatar}>
          {driver.profileImage ? (
            <Image source={{ uri: driver.profileImage }} style={styles.compactAvatarImage} />
          ) : (
            <Text style={styles.compactAvatarText}>
              {driver.firstName.charAt(0).toUpperCase()}
            </Text>
          )}
          {driver.isVerified && (
            <View style={styles.compactVerifiedDot}>
              <Icon name="check" size={8} color="#FFFFFF" />
            </View>
          )}
        </View>
        <View style={styles.compactInfo}>
          <Text style={styles.compactName} numberOfLines={1}>
            {driver.firstName} {driver.lastName.charAt(0)}.
          </Text>
          <View style={styles.compactRating}>
            <Icon name="star" size={12} color="#F59E0B" />
            <Text style={styles.compactRatingText}>{driver.rating.toFixed(1)}</Text>
          </View>
        </View>
        {vehicle && (
          <Text style={styles.compactPlate}>{vehicle.licensePlate}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      {/* Driver info row */}
      <View style={styles.driverRow}>
        <View style={styles.avatarContainer}>
          {driver.profileImage ? (
            <Image source={{ uri: driver.profileImage }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {driver.firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {driver.isVerified && (
            <View style={styles.verifiedBadgeIcon}>
              <Icon name="check" size={10} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={styles.driverDetails}>
          <View style={styles.nameRow}>
            <Text style={styles.driverName}>
              {driver.firstName} {driver.lastName}
            </Text>
            {getVerificationBadge()}
          </View>

          <View style={styles.ratingRow}>
            <View style={styles.stars}>{renderStars(driver.rating)}</View>
            <Text style={styles.ratingValue}>{driver.rating.toFixed(1)}</Text>
            <Text style={styles.rideCount}>({driver.totalRides} rides)</Text>
          </View>

          {driver.memberSince && (
            <Text style={styles.memberSince}>
              Member since {driver.memberSince}
            </Text>
          )}
        </View>

        {/* Contact actions */}
        {(onContactPress || onCallPress) && (
          <View style={styles.contactActions}>
            {onContactPress && (
              <TouchableOpacity style={styles.contactBtn} onPress={onContactPress}>
                <Icon name="message" size={18} color="#2563EB" />
              </TouchableOpacity>
            )}
            {onCallPress && (
              <TouchableOpacity style={styles.contactBtn} onPress={onCallPress}>
                <Icon name="call" size={18} color="#10B981" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Vehicle info */}
      {vehicle && (
        <View style={styles.vehicleSection}>
          <View style={styles.vehicleDivider} />
          <View style={styles.vehicleRow}>
            <View style={styles.vehicleIconContainer}>
              {vehicle.photo ? (
                <Image source={{ uri: vehicle.photo }} style={styles.vehiclePhoto} />
              ) : (
                <Icon name="directions-car" size={28} color={colors.primary} />
              )}
            </View>
            <View style={styles.vehicleDetails}>
              <Text style={styles.vehicleName}>
                {vehicle.year ? `${vehicle.year} ` : ''}{vehicle.make} {vehicle.model}
              </Text>
              <Text style={styles.vehicleColor}>{vehicle.color}</Text>
            </View>
            <View style={styles.plateContainer}>
              <Text style={styles.plateLabel}>Plate</Text>
              <View style={styles.plateBadge}>
                <Text style={styles.plateText}>{vehicle.licensePlate}</Text>
              </View>
            </View>
          </View>

          {/* Vehicle verification status */}
          {vehicle.isInspected && (
            <View style={styles.inspectionBadge}>
              <Icon name="check-circle" size={14} color="#10B981" />
              <Text style={styles.inspectionText}>Vehicle inspected</Text>
            </View>
          )}
        </View>
      )}

      {/* Safety info bar */}
      <View style={styles.safetyBar}>
        {driver.isVerified && (
          <View style={styles.safetyItem}>
            <Icon name="verified-user" size={14} color="#10B981" />
            <Text style={styles.safetyText}>ID Checked</Text>
          </View>
        )}
        {vehicle?.isInspected && (
          <View style={styles.safetyItem}>
            <Icon name="build" size={14} color="#2563EB" />
            <Text style={styles.safetyText}>Inspected</Text>
          </View>
        )}
        {driver.totalRides > 50 && (
          <View style={styles.safetyItem}>
            <Icon name="emoji-events" size={14} color="#F59E0B" />
            <Text style={styles.safetyText}>Experienced</Text>
          </View>
        )}
        {driver.rating >= 4.5 && (
          <View style={styles.safetyItem}>
            <Icon name="thumb-up" size={14} color="#8B5CF6" />
            <Text style={styles.safetyText}>Top Rated</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatarImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.primary,
  },
  verifiedBadgeIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  driverDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  verificationText: {
    fontSize: 10,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stars: {
    flexDirection: 'row',
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: 2,
  },
  rideCount: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  memberSince: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  contactBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleSection: {
    marginTop: 4,
  },
  vehicleDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  vehiclePhoto: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  vehicleColor: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  plateContainer: {
    alignItems: 'center',
  },
  plateLabel: {
    fontSize: 9,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  plateBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B' + '40',
  },
  plateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 1,
  },
  inspectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingLeft: 56,
  },
  inspectionText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
  },
  safetyBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  safetyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  safetyText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  // Compact styles
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  compactAvatar: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  compactAvatarText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  compactVerifiedDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  compactRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  compactRatingText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  compactPlate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },
});

export default DriverVerificationCard;
