/**
 * @fileoverview Reusable skeleton loading components for placeholder UI
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
  StyleProp,
} from 'react-native';

// ─── Base Skeleton ───────────────────────────────────────────────────

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 6,
  style,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as ViewStyle['width'],
          height,
          borderRadius,
          backgroundColor: '#E5E7EB',
          opacity,
        },
        style,
      ]}
    />
  );
};

// ─── Skeleton for a circle (avatar) ─────────────────────────────────

interface SkeletonCircleProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const SkeletonCircle: React.FC<SkeletonCircleProps> = ({
  size = 40,
  style,
}) => (
  <Skeleton
    width={size}
    height={size}
    borderRadius={size / 2}
    style={style}
  />
);

// ─── Preset: Ride Card Skeleton ─────────────────────────────────────

export const RideCardSkeleton: React.FC = () => (
  <View style={skeletonStyles.rideCard}>
    <View style={skeletonStyles.rideCardHeader}>
      <SkeletonCircle size={42} />
      <View style={skeletonStyles.rideCardHeaderText}>
        <Skeleton width={120} height={14} />
        <Skeleton width={80} height={11} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={60} height={24} borderRadius={12} />
    </View>
    <View style={skeletonStyles.rideCardRoute}>
      <View style={skeletonStyles.rideCardDots}>
        <Skeleton width={10} height={10} borderRadius={5} />
        <View style={skeletonStyles.rideCardLine} />
        <Skeleton width={10} height={10} borderRadius={5} />
      </View>
      <View style={skeletonStyles.rideCardAddresses}>
        <Skeleton width="85%" height={13} />
        <Skeleton width="70%" height={13} />
      </View>
    </View>
    <View style={skeletonStyles.rideCardFooter}>
      <Skeleton width={70} height={12} />
      <Skeleton width={50} height={12} />
      <Skeleton width={60} height={12} />
    </View>
  </View>
);

// ─── Preset: Profile Skeleton ───────────────────────────────────────

export const ProfileSkeleton: React.FC = () => (
  <View style={skeletonStyles.profile}>
    <SkeletonCircle size={80} />
    <Skeleton width={140} height={18} style={{ marginTop: 14 }} />
    <Skeleton width={100} height={12} style={{ marginTop: 8 }} />
    <View style={skeletonStyles.profileStats}>
      {[1, 2, 3].map(i => (
        <View key={i} style={skeletonStyles.profileStat}>
          <Skeleton width={40} height={20} />
          <Skeleton width={50} height={11} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  </View>
);

// ─── Preset: Message List Skeleton ──────────────────────────────────

export const MessageListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <View>
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={skeletonStyles.messageRow}>
        <SkeletonCircle size={48} />
        <View style={skeletonStyles.messageContent}>
          <View style={skeletonStyles.messageHeader}>
            <Skeleton width={100} height={14} />
            <Skeleton width={40} height={10} />
          </View>
          <Skeleton width="90%" height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
    ))}
  </View>
);

// ─── Preset: Full Screen Skeleton ───────────────────────────────────

export const ScreenSkeleton: React.FC<{ type?: 'rides' | 'messages' | 'profile' }> = ({
  type = 'rides',
}) => {
  if (type === 'messages') {
    return (
      <View style={skeletonStyles.screen}>
        <Skeleton width="60%" height={20} style={{ marginBottom: 20 }} />
        <MessageListSkeleton />
      </View>
    );
  }

  if (type === 'profile') {
    return (
      <View style={skeletonStyles.screen}>
        <ProfileSkeleton />
        <View style={{ marginTop: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={skeletonStyles.settingsRow}>
              <Skeleton width={24} height={24} borderRadius={6} />
              <Skeleton width="60%" height={14} style={{ marginLeft: 12 }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Default: rides
  return (
    <View style={skeletonStyles.screen}>
      <Skeleton width="45%" height={20} style={{ marginBottom: 16 }} />
      <RideCardSkeleton />
      <RideCardSkeleton />
      <RideCardSkeleton />
    </View>
  );
};

const skeletonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  rideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  rideCardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  rideCardRoute: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  rideCardDots: {
    alignItems: 'center',
    marginRight: 12,
    paddingVertical: 2,
    gap: 2,
  },
  rideCardLine: {
    width: 2,
    height: 16,
    backgroundColor: '#E5E7EB',
  },
  rideCardAddresses: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 12,
  },
  rideCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  profile: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  profileStats: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 20,
  },
  profileStat: {
    alignItems: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  messageContent: {
    flex: 1,
    marginLeft: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
});
