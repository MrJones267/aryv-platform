/**
 * @fileoverview Group Chat Message Component
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing, typography } from '../theme';

const { width: screenWidth } = Dimensions.get('window');

interface GroupMessage {
  id: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: string;
  isRead: boolean;
  reactions: any;
  isPinned: boolean;
  replyToMessage?: any;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

interface GroupChatMessageProps {
  message: GroupMessage;
  currentUserId?: string;
  onPress: () => void;
  onReply: () => void;
}

export const GroupChatMessage: React.FC<GroupChatMessageProps> = ({
  message,
  currentUserId,
  onPress,
  onReply,
}) => {
  const isOwn = message.senderId === currentUserId;
  const isSystem = message.senderId === 'system';

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const renderReactions = () => {
    if (!message.reactions || Object.keys(message.reactions).length === 0) {
      return null;
    }

    return (
      <View style={styles.reactionsContainer}>
        {Object.entries(message.reactions).map(([emoji, users]: [string, any]) => (
          <View key={emoji} style={styles.reaction}>
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            <Text style={styles.reactionCount}>{Array.isArray(users) ? users.length : 1}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderReplyMessage = () => {
    if (!message.replyToMessage) return null;

    return (
      <View style={styles.replyContainer}>
        <View style={styles.replyLine} />
        <View style={styles.replyContent}>
          <Text style={styles.replyAuthor}>
            {message.replyToMessage.sender.firstName}
          </Text>
          <Text style={styles.replyText} numberOfLines={1}>
            {message.replyToMessage.content}
          </Text>
        </View>
      </View>
    );
  };

  const renderAvatar = () => {
    if (isOwn || isSystem) return null;

    return (
      <View style={styles.avatarContainer}>
        {message.sender.profilePicture ? (
          <Image 
            source={{ uri: message.sender.profilePicture }} 
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {getInitials(message.sender.firstName, message.sender.lastName)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isSystem) {
    return (
      <View style={styles.systemMessageContainer}>
        <Text style={styles.systemMessageText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
      {!isOwn && renderAvatar()}
      
      <View style={[styles.messageBubble, isOwn && styles.ownMessageBubble]}>
        {message.isPinned && (
          <View style={styles.pinnedIndicator}>
            <MaterialIcon name="push-pin" size={12} color={colors.warning} />
            <Text style={styles.pinnedText}>Pinned</Text>
          </View>
        )}

        {!isOwn && (
          <Text style={styles.senderName}>
            {message.sender.firstName} {message.sender.lastName}
          </Text>
        )}

        {renderReplyMessage()}

        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
            {message.content}
          </Text>
        </TouchableOpacity>

        {renderReactions()}

        <View style={[styles.messageFooter, isOwn && styles.ownMessageFooter]}>
          <Text style={[styles.timeText, isOwn && styles.ownTimeText]}>
            {formatTime(message.createdAt)}
          </Text>
          
          {isOwn && (
            <View style={styles.statusIndicator}>
              <Icon 
                name={message.isRead ? "checkmark-done" : "checkmark"} 
                size={12} 
                color={message.isRead ? colors.success : colors.textSecondary} 
              />
            </View>
          )}
        </View>
      </View>

      {!isOwn && (
        <TouchableOpacity style={styles.replyButton} onPress={onReply}>
          <Icon name="arrow-undo" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
    marginHorizontal: spacing.md,
    alignItems: 'flex-end',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.caption,
    color: colors.white,
    fontWeight: 'bold',
  },
  messageBubble: {
    maxWidth: screenWidth * 0.7,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  ownMessageBubble: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
  },
  pinnedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  pinnedText: {
    fontSize: typography.fontSize.caption,
    color: colors.warning,
    marginLeft: spacing.xs,
    fontWeight: 'bold',
  },
  senderName: {
    fontSize: typography.fontSize.caption,
    color: colors.primary,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  replyContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    paddingLeft: spacing.xs,
  },
  replyLine: {
    width: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginRight: spacing.xs,
  },
  replyContent: {
    flex: 1,
  },
  replyAuthor: {
    fontSize: typography.fontSize.caption,
    color: colors.primary,
    fontWeight: 'bold',
  },
  replyText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: typography.fontSize.body,
    color: colors.text.primary,
    lineHeight: 20,
  },
  ownMessageText: {
    color: colors.white,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: spacing.xs,
  },
  ownMessageFooter: {
    justifyContent: 'flex-end',
  },
  timeText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  ownTimeText: {
    color: colors.white,
    opacity: 0.8,
  },
  statusIndicator: {
    marginLeft: spacing.xs,
  },
  replyButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
    opacity: 0.6,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  systemMessageText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    textAlign: 'center',
  },
});

export default GroupChatMessage;