/**
 * @fileoverview Offline status banner shown at top of screens when disconnected
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useOfflineMode } from '../../hooks/useOfflineMode';

interface OfflineBannerProps {
  showPendingCount?: boolean;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({ showPendingCount = true }) => {
  const { isOffline, pendingActions, wasOffline } = useOfflineMode();
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOffline) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOffline, slideAnim, opacityAnim]);

  if (!isOffline && !wasOffline) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Icon name="cloud-off" size={16} color="#FFFFFF" />
      <Text style={styles.text}>
        You're offline
        {showPendingCount && pendingActions > 0
          ? ` (${pendingActions} pending)`
          : ' — some features may be limited'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#6B7280',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

export default OfflineBanner;
