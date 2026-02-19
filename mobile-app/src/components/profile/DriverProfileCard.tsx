/**
 * @fileoverview Driver profile card with vehicle gallery and trust indicators
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import UserProfileCard, { UserProfileData } from './UserProfileCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_IMAGE_SIZE = 120;

export interface VehicleData {
  id?: string;
  make: string;
  model: string;
  year?: number;
  color: string;
  licensePlate: string;
  vehicleType?: string;
  seatsAvailable?: number;
  photos?: string[];
  isVerified?: boolean;
  isInspected?: boolean;
}

interface DriverProfileCardProps {
  driver: UserProfileData;
  vehicle?: VehicleData;
  onPress?: () => void;
  onContactPress?: () => void;
  onCallPress?: () => void;
  onVehiclePhotoPress?: (photoUri: string, index: number) => void;
  compact?: boolean;
  style?: ViewStyle;
}

const DriverProfileCard: React.FC<DriverProfileCardProps> = ({
  driver,
  vehicle,
  onPress,
  onContactPress,
  onCallPress,
  onVehiclePhotoPress,
  compact = false,
  style,
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const renderVehicleGallery = () => {
    if (!vehicle?.photos || vehicle.photos.length === 0) return null;

    return (
      <View style={styles.gallerySection}>
        <Text style={styles.gallerySectionTitle}>Vehicle Photos</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.galleryScroll}
          snapToInterval={GALLERY_IMAGE_SIZE + 8}
          decelerationRate="fast"
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / (GALLERY_IMAGE_SIZE + 8));
            setActivePhotoIndex(index);
          }}
        >
          {vehicle.photos.map((photo, index) => (
            <TouchableOpacity
              key={index}
              style={styles.galleryImageWrap}
              onPress={() => onVehiclePhotoPress?.(photo, index)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: photo }} style={styles.galleryImage} />
            </TouchableOpacity>
          ))}
        </ScrollView>
        {vehicle.photos.length > 1 && (
          <View style={styles.galleryDots}>
            {vehicle.photos.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.galleryDot,
                  index === activePhotoIndex && styles.galleryDotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderVehicleInfo = () => {
    if (!vehicle) return null;

    return (
      <View style={styles.vehicleSection}>
        <View style={styles.vehicleDivider} />
        <View style={styles.vehicleRow}>
          <View style={styles.vehicleIconWrap}>
            {vehicle.photos && vehicle.photos.length > 0 ? (
              <Image source={{ uri: vehicle.photos[0] }} style={styles.vehicleThumb} />
            ) : (
              <Icon name="directions-car" size={26} color={colors.primary} />
            )}
          </View>
          <View style={styles.vehicleDetails}>
            <Text style={styles.vehicleName}>
              {vehicle.year ? `${vehicle.year} ` : ''}{vehicle.make} {vehicle.model}
            </Text>
            <View style={styles.vehicleMeta}>
              <Text style={styles.vehicleColor}>{vehicle.color}</Text>
              {vehicle.seatsAvailable !== undefined && (
                <>
                  <View style={styles.metaDot} />
                  <Icon name="event-seat" size={12} color={colors.text.secondary} />
                  <Text style={styles.vehicleSeats}>{vehicle.seatsAvailable} seats</Text>
                </>
              )}
            </View>
          </View>
          <View style={styles.plateContainer}>
            <Text style={styles.plateLabel}>Plate</Text>
            <View style={styles.plateBadge}>
              <Text style={styles.plateText}>{vehicle.licensePlate}</Text>
            </View>
          </View>
        </View>

        {/* Vehicle badges */}
        <View style={styles.vehicleBadges}>
          {vehicle.isVerified && (
            <View style={styles.vehicleBadge}>
              <Icon name="verified" size={13} color="#2563EB" />
              <Text style={styles.vehicleBadgeText}>Registered</Text>
            </View>
          )}
          {vehicle.isInspected && (
            <View style={styles.vehicleBadge}>
              <Icon name="check-circle" size={13} color="#10B981" />
              <Text style={styles.vehicleBadgeTextGreen}>Inspected</Text>
            </View>
          )}
          {vehicle.vehicleType && (
            <View style={styles.vehicleBadge}>
              <Icon name="local-taxi" size={13} color="#F59E0B" />
              <Text style={styles.vehicleBadgeTextAmber}>
                {vehicle.vehicleType.charAt(0).toUpperCase() + vehicle.vehicleType.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Vehicle photo gallery */}
        {renderVehicleGallery()}
      </View>
    );
  };

  const renderContactActions = () => {
    if (!onContactPress && !onCallPress) return null;

    return (
      <View style={styles.contactRow}>
        {onContactPress && (
          <TouchableOpacity style={styles.contactButton} onPress={onContactPress}>
            <Icon name="message" size={18} color="#2563EB" />
            <Text style={styles.contactButtonText}>Message</Text>
          </TouchableOpacity>
        )}
        {onCallPress && (
          <TouchableOpacity style={[styles.contactButton, styles.callButton]} onPress={onCallPress}>
            <Icon name="call" size={18} color="#10B981" />
            <Text style={[styles.contactButtonText, styles.callButtonText]}>Call</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (compact) {
    return (
      <UserProfileCard
        user={driver}
        variant="compact"
        onPress={onPress}
        style={style}
        showBio={false}
        showStats={false}
        showVerification={true}
      />
    );
  }

  return (
    <View style={[styles.card, style]}>
      {/* User profile section */}
      <UserProfileCard
        user={driver}
        variant="full"
        onPress={onPress}
        onMessagePress={onContactPress}
        showBio={true}
        showStats={true}
        showVerification={true}
        style={styles.profileSection}
      />

      {/* Vehicle section */}
      {renderVehicleInfo()}

      {/* Contact actions */}
      {renderContactActions()}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  profileSection: {
    elevation: 0,
    shadowOpacity: 0,
    borderRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },

  // ─── Vehicle section ────────────────────────────
  vehicleSection: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  vehicleDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 14,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  vehicleThumb: {
    width: 46,
    height: 46,
    borderRadius: 10,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  vehicleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  vehicleColor: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.light,
  },
  vehicleSeats: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: 1,
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

  // Vehicle badges
  vehicleBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  vehicleBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#2563EB',
  },
  vehicleBadgeTextGreen: {
    fontSize: 11,
    fontWeight: '500',
    color: '#10B981',
  },
  vehicleBadgeTextAmber: {
    fontSize: 11,
    fontWeight: '500',
    color: '#92400E',
  },

  // ─── Gallery ────────────────────────────────────
  gallerySection: {
    marginTop: 14,
  },
  gallerySectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  galleryScroll: {
    gap: 8,
  },
  galleryImageWrap: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  galleryImage: {
    width: GALLERY_IMAGE_SIZE,
    height: GALLERY_IMAGE_SIZE * 0.75,
    borderRadius: 10,
  },
  galleryDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
  },
  galleryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  galleryDotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },

  // ─── Contact row ────────────────────────────────
  contactRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingTop: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  callButton: {
    backgroundColor: '#ECFDF5',
  },
  callButtonText: {
    color: '#10B981',
  },
});

export default DriverProfileCard;
