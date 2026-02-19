/**
 * @fileoverview Reusable user profile card showing photo, rating, verification badges, and stats
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
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';

export interface UserProfileData {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  rating: number;
  totalRides: number;
  totalDeliveries?: number;
  memberSince?: string;
  bio?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  isIdentityVerified?: boolean;
  isDriverVerified?: boolean;
  primaryRole?: 'passenger' | 'driver' | 'courier' | 'admin';
}

type CardVariant = 'full' | 'compact' | 'inline';

interface UserProfileCardProps {
  user: UserProfileData;
  variant?: CardVariant;
  onPress?: () => void;
  onMessagePress?: () => void;
  showBio?: boolean;
  showStats?: boolean;
  showVerification?: boolean;
  style?: ViewStyle;
}

const UserProfileCard: React.FC<UserProfileCardProps> = ({
  user,
  variant = 'full',
  onPress,
  onMessagePress,
  showBio = true,
  showStats = true,
  showVerification = true,
  style,
}) => {
  const renderStars = (rating: number): React.ReactNode => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Icon key={i} name="star" size={13} color="#F59E0B" />);
      } else if (i === fullStars && hasHalf) {
        stars.push(<Icon key={i} name="star-half" size={13} color="#F59E0B" />);
      } else {
        stars.push(<Icon key={i} name="star-border" size={13} color="#D1D5DB" />);
      }
    }
    return stars;
  };

  const getInitials = (): string => {
    const first = user.firstName?.charAt(0) || '';
    const last = user.lastName?.charAt(0) || '';
    return (first + last).toUpperCase();
  };

  const getTrustLevel = (): { label: string; color: string; icon: string } => {
    let score = 0;
    if (user.isEmailVerified) score++;
    if (user.isPhoneVerified) score++;
    if (user.isIdentityVerified) score += 2;
    if (user.isDriverVerified) score++;
    if (user.totalRides > 50) score++;
    if (user.rating >= 4.5) score++;

    if (score >= 5) return { label: 'Highly Trusted', color: '#10B981', icon: 'verified-user' };
    if (score >= 3) return { label: 'Verified', color: '#2563EB', icon: 'verified' };
    if (score >= 1) return { label: 'Basic', color: '#6B7280', icon: 'shield' };
    return { label: 'New', color: '#9CA3AF', icon: 'person-outline' };
  };

  const verificationBadges = [
    { key: 'email', verified: user.isEmailVerified, icon: 'email', label: 'Email' },
    { key: 'phone', verified: user.isPhoneVerified, icon: 'phone', label: 'Phone' },
    { key: 'id', verified: user.isIdentityVerified, icon: 'badge', label: 'ID' },
    { key: 'driver', verified: user.isDriverVerified, icon: 'directions-car', label: 'Driver' },
  ];

  const verifiedCount = verificationBadges.filter(b => b.verified).length;

  const renderAvatar = (size: number) => (
    <View style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2 }]}>
      {user.profilePicture ? (
        <Image
          source={{ uri: user.profilePicture }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.avatarInitials, { fontSize: size * 0.38 }]}>
            {getInitials()}
          </Text>
        </View>
      )}
    </View>
  );

  // Inline variant — minimal, for lists (e.g., passenger list in bookings)
  if (variant === 'inline') {
    return (
      <TouchableOpacity
        style={[styles.inlineCard, style]}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        {renderAvatar(36)}
        <View style={styles.inlineInfo}>
          <Text style={styles.inlineName} numberOfLines={1}>
            {user.firstName} {user.lastName.charAt(0)}.
          </Text>
          <View style={styles.inlineRating}>
            <Icon name="star" size={12} color="#F59E0B" />
            <Text style={styles.inlineRatingText}>
              {user.rating.toFixed(1)}
            </Text>
            {verifiedCount > 0 && (
              <>
                <View style={styles.inlineDot} />
                <Icon name="verified-user" size={11} color="#10B981" />
              </>
            )}
          </View>
        </View>
        {onMessagePress && (
          <TouchableOpacity style={styles.inlineActionBtn} onPress={onMessagePress}>
            <Icon name="message" size={16} color="#2563EB" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  // Compact variant — for search results and ride cards
  if (variant === 'compact') {
    const trust = getTrustLevel();
    return (
      <TouchableOpacity
        style={[styles.compactCard, style]}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        <View style={styles.compactAvatarWrap}>
          {renderAvatar(48)}
          {verifiedCount >= 2 && (
            <View style={styles.compactVerifiedDot}>
              <Icon name="check" size={9} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={styles.compactDetails}>
          <Text style={styles.compactName} numberOfLines={1}>
            {user.firstName} {user.lastName}
          </Text>
          <View style={styles.compactRatingRow}>
            <View style={styles.starsRow}>{renderStars(user.rating)}</View>
            <Text style={styles.compactRatingValue}>{user.rating.toFixed(1)}</Text>
            <Text style={styles.compactRideCount}>({user.totalRides} rides)</Text>
          </View>
          {showVerification && (
            <View style={[styles.trustBadge, { backgroundColor: trust.color + '12' }]}>
              <Icon name={trust.icon} size={11} color={trust.color} />
              <Text style={[styles.trustText, { color: trust.color }]}>{trust.label}</Text>
            </View>
          )}
        </View>

        {onPress && (
          <Icon name="chevron-right" size={20} color={colors.text.light} />
        )}
      </TouchableOpacity>
    );
  }

  // Full variant — profile detail view
  const trust = getTrustLevel();

  return (
    <TouchableOpacity
      style={[styles.fullCard, style]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      {/* Top section: avatar + name + rating */}
      <View style={styles.fullHeader}>
        <View style={styles.fullAvatarWrap}>
          {renderAvatar(68)}
          {verifiedCount >= 2 && (
            <View style={styles.fullVerifiedBadge}>
              <Icon name="check" size={11} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={styles.fullHeaderInfo}>
          <Text style={styles.fullName}>
            {user.firstName} {user.lastName}
          </Text>
          <View style={styles.fullRatingRow}>
            <View style={styles.starsRow}>{renderStars(user.rating)}</View>
            <Text style={styles.fullRatingValue}>{user.rating.toFixed(1)}</Text>
          </View>
          {user.memberSince && (
            <Text style={styles.fullMemberSince}>
              Member since {user.memberSince}
            </Text>
          )}
        </View>

        {onMessagePress && (
          <TouchableOpacity style={styles.fullMessageBtn} onPress={onMessagePress}>
            <Icon name="message" size={18} color="#2563EB" />
          </TouchableOpacity>
        )}
      </View>

      {/* Bio */}
      {showBio && user.bio && (
        <Text style={styles.fullBio} numberOfLines={3}>
          {user.bio}
        </Text>
      )}

      {/* Verification badges */}
      {showVerification && (
        <View style={styles.verificationSection}>
          <View style={styles.verificationRow}>
            {verificationBadges.map(badge => (
              <View
                key={badge.key}
                style={[
                  styles.verificationItem,
                  badge.verified ? styles.verificationVerified : styles.verificationPending,
                ]}
              >
                <Icon
                  name={badge.verified ? 'check-circle' : 'radio-button-unchecked'}
                  size={13}
                  color={badge.verified ? '#10B981' : '#D1D5DB'}
                />
                <Text
                  style={[
                    styles.verificationLabel,
                    badge.verified ? styles.verifiedLabel : styles.pendingLabel,
                  ]}
                >
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={[styles.trustBadgeFull, { backgroundColor: trust.color + '12' }]}>
            <Icon name={trust.icon} size={13} color={trust.color} />
            <Text style={[styles.trustTextFull, { color: trust.color }]}>
              {trust.label}
            </Text>
          </View>
        </View>
      )}

      {/* Stats */}
      {showStats && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.totalRides}</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.rating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          {user.totalDeliveries !== undefined && user.totalDeliveries > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user.totalDeliveries}</Text>
                <Text style={styles.statLabel}>Deliveries</Text>
              </View>
            </>
          )}
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{verifiedCount}/{verificationBadges.length}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // ─── Avatar ─────────────────────────────────────
  avatarContainer: {
    overflow: 'hidden',
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontWeight: '600',
    color: colors.primary,
  },

  // ─── Stars ──────────────────────────────────────
  starsRow: {
    flexDirection: 'row',
  },

  // ─── Inline variant ─────────────────────────────
  inlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 10,
  },
  inlineInfo: {
    flex: 1,
  },
  inlineName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  inlineRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  inlineRatingText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  inlineDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.light,
    marginHorizontal: 2,
  },
  inlineActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Compact variant ────────────────────────────
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  compactAvatarWrap: {
    position: 'relative',
  },
  compactVerifiedDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  compactDetails: {
    flex: 1,
  },
  compactName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 3,
  },
  compactRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  compactRatingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: 2,
  },
  compactRideCount: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  trustText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // ─── Full variant ───────────────────────────────
  fullCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullAvatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  fullVerifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fullHeaderInfo: {
    flex: 1,
  },
  fullName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 3,
  },
  fullRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fullRatingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: 2,
  },
  fullMemberSince: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 3,
  },
  fullMessageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullBio: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19,
    marginTop: 12,
  },

  // Verification section
  verificationSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  verificationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  verificationVerified: {
    backgroundColor: '#10B981' + '10',
  },
  verificationPending: {
    backgroundColor: '#F3F4F6',
  },
  verificationLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  verifiedLabel: {
    color: '#10B981',
  },
  pendingLabel: {
    color: '#9CA3AF',
  },
  trustBadgeFull: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  trustTextFull: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#F3F4F6',
  },
});

export default UserProfileCard;
