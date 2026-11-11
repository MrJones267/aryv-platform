/**
 * @fileoverview Notice that a ride's chat will be deleted after the trip
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2026-11-11
 *
 * This used to offer a vote to keep the group. Ride chats are now deleted
 * with their messages a day after the trip, for everyone, so there is
 * nothing to vote on; the server refuses the vote.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing, typography } from '../theme';

interface GroupCompletionBannerProps {
  groupChatId: string;
  /** Hours until the chat and its messages are deleted. */
  autoArchiveIn: number;
  /** No longer used: kept so existing callers compile. */
  currentVotes?: unknown;
  onVoteUpdate?: (votes: Record<string, unknown>) => void;
  onDismiss?: () => void;
}

/** "24 hours", "1 hour", or "45 minutes". */
export const timeUntilDeleted = (hoursLeft: number): string => {
  const hours = Math.floor(hoursLeft);
  if (hours >= 1) {return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;}
  const minutes = Math.max(1, Math.round(hoursLeft * 60));
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
};

export const GroupCompletionBanner: React.FC<GroupCompletionBannerProps> = ({
  autoArchiveIn,
  onDismiss,
}) => {
  const [animatedValue] = useState(new Animated.Value(1));

  const handleDismiss = () => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onDismiss?.();
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity: animatedValue }]}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <MaterialIcon name="celebration" size={24} color={colors.success} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Trip completed</Text>
          <Text style={styles.subtitle}>
            This chat and its messages will be deleted in {timeUntilDeleted(autoArchiveIn)}.
          </Text>
        </View>
        <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss} accessibilityLabel="Dismiss">
          <Icon name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warning + '15',
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    margin: spacing.sm,
    borderRadius: 8,
    padding: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.body,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  dismissButton: {
    padding: spacing.xs,
  },
});

export default GroupCompletionBanner;
