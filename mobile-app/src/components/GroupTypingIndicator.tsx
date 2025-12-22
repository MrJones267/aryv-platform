/**
 * @fileoverview Group Typing Indicator Component
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography } from '../theme';

interface GroupTypingIndicatorProps {
  userIds: string[];
  userNames?: string[];
}

export const GroupTypingIndicator: React.FC<GroupTypingIndicatorProps> = ({
  userIds,
  userNames = [],
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (userIds.length > 0) {
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Pulse animation for dots
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => {
        pulseAnimation.stop();
      };
    } else {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [userIds, fadeAnim, pulseAnim]);

  const getTypingText = () => {
    const count = userIds.length;
    
    if (count === 0) return '';
    
    if (count === 1) {
      const name = userNames.length > 0 ? userNames[0] : 'Someone';
      return `${name} is typing`;
    }
    
    if (count === 2) {
      if (userNames.length >= 2) {
        return `${userNames[0]} and ${userNames[1]} are typing`;
      }
      return 'Two people are typing';
    }
    
    if (count === 3) {
      if (userNames.length >= 3) {
        return `${userNames[0]}, ${userNames[1]} and ${userNames[2]} are typing`;
      }
      return 'Three people are typing';
    }
    
    return `${count} people are typing`;
  };

  const renderTypingDots = () => (
    <Animated.View style={[styles.dotsContainer, { opacity: pulseAnim }]}>
      <View style={[styles.dot, styles.dot1]} />
      <View style={[styles.dot, styles.dot2]} />
      <View style={[styles.dot, styles.dot3]} />
    </Animated.View>
  );

  if (userIds.length === 0) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          {renderTypingDots()}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.typingText}>{getTypingText()}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textSecondary,
    marginHorizontal: 1,
  },
  dot1: {
    // Individual dot animations could be added here
  },
  dot2: {
    // Individual dot animations could be added here
  },
  dot3: {
    // Individual dot animations could be added here
  },
  textContainer: {
    flex: 1,
  },
  typingText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default GroupTypingIndicator;