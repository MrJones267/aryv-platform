/**
 * @fileoverview Group Completion Banner Component for ride completion voting
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { GroupChatService } from '../services/GroupChatService';
import { colors, spacing, typography } from '../theme';
import logger from '../services/LoggingService';

const log = logger.createLogger('GroupCompletionBanner');

interface GroupCompletionBannerProps {
  groupChatId: string;
  autoArchiveIn: number; // hours
  currentVotes?: {
    keepVotes: number;
    totalVotes: number;
    requiredVotes: number;
    userVote?: boolean;
  };
  onVoteUpdate?: (votes: Record<string, unknown>) => void;
  onDismiss?: () => void;
}

export const GroupCompletionBanner: React.FC<GroupCompletionBannerProps> = ({
  groupChatId,
  autoArchiveIn,
  currentVotes,
  onVoteUpdate,
  onDismiss,
}) => {
  const [userVote, setUserVote] = useState<boolean | null>(
    currentVotes?.userVote !== undefined ? currentVotes.userVote : null
  );
  const [isVoting, setIsVoting] = useState(false);
  const [animatedValue] = useState(new Animated.Value(1));

  const handleVote = async (keepActive: boolean) => {
    if (isVoting) return;

    try {
      setIsVoting(true);
      const response = await GroupChatService.voteToKeepGroup(groupChatId, keepActive);
      
      if (response.success) {
        setUserVote(keepActive);
        Alert.alert(
          'Vote Recorded',
          keepActive 
            ? 'Your vote to keep the group active has been recorded.'
            : 'Your vote to archive the group has been recorded.'
        );
      }
    } catch (error) {
      log.error('Error voting:', error);
      Alert.alert('Error', 'Failed to record your vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  const handleDismiss = () => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onDismiss?.();
    });
  };

  const getTimeRemaining = () => {
    const hours = Math.floor(autoArchiveIn);
    const minutes = Math.floor((autoArchiveIn - hours) * 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getVoteStatus = () => {
    if (!currentVotes) return null;

    const { keepVotes, totalVotes, requiredVotes } = currentVotes;
    const progress = (keepVotes / requiredVotes) * 100;
    
    return (
      <View style={styles.voteStatus}>
        <View style={styles.voteProgress}>
          <View style={[styles.progressBar, { width: `${Math.min(progress, 100)}%` }]} />
        </View>
        <Text style={styles.voteText}>
          {keepVotes}/{requiredVotes} votes to keep active
        </Text>
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: animatedValue }]}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <MaterialIcon name="celebration" size={24} color={colors.success} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Trip Completed!</Text>
          <Text style={styles.subtitle}>
            This group will be archived in {getTimeRemaining()} unless members vote to keep it active.
          </Text>
        </View>
        <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
          <Icon name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {currentVotes && getVoteStatus()}

      {userVote === null ? (
        <View style={styles.voteButtons}>
          <TouchableOpacity
            style={[styles.voteButton, styles.keepButton]}
            onPress={() => handleVote(true)}
            disabled={isVoting}
          >
            <Icon name="heart" size={20} color={colors.white} />
            <Text style={styles.voteButtonText}>Keep Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteButton, styles.archiveButton]}
            onPress={() => handleVote(false)}
            disabled={isVoting}
          >
            <Icon name="archive" size={20} color={colors.white} />
            <Text style={styles.voteButtonText}>Archive</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.votedContainer}>
          <View style={[
            styles.votedIndicator,
            userVote ? styles.votedKeep : styles.votedArchive,
          ]}>
            <Icon 
              name={userVote ? "heart" : "archive"} 
              size={16} 
              color={colors.white} 
            />
            <Text style={styles.votedText}>
              You voted to {userVote ? 'keep' : 'archive'} this group
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warning + '15', // Light warning background
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    margin: spacing.sm,
    borderRadius: 8,
    padding: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
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
  voteStatus: {
    marginBottom: spacing.sm,
  },
  voteProgress: {
    height: 4,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 2,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  voteText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  voteButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  voteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    gap: spacing.xs,
  },
  keepButton: {
    backgroundColor: colors.success,
  },
  archiveButton: {
    backgroundColor: colors.textSecondary,
  },
  voteButtonText: {
    fontSize: typography.fontSize.caption,
    color: colors.white,
    fontWeight: 'bold',
  },
  votedContainer: {
    alignItems: 'center',
  },
  votedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    gap: spacing.xs,
  },
  votedKeep: {
    backgroundColor: colors.success,
  },
  votedArchive: {
    backgroundColor: colors.textSecondary,
  },
  votedText: {
    fontSize: typography.fontSize.caption,
    color: colors.white,
    fontWeight: '500',
  },
});

export default GroupCompletionBanner;