/**
 * @fileoverview Group Chat List Item Component
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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing, typography } from '../theme';

interface GroupChat {
  id: string;
  name: string;
  description?: string;
  type: string;
  participantCount: number;
  unreadCount: number;
  lastMessage?: {
    content: string;
    senderId: string;
    senderName: string;
    createdAt: string;
    type: string;
  };
  isOnline?: boolean;
  avatarUrl?: string;
}

interface GroupChatListItemProps {
  groupChat: GroupChat;
  onPress: () => void;
}

export const GroupChatListItem: React.FC<GroupChatListItemProps> = ({
  groupChat,
  onPress,
}) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getGroupTypeIcon = (type: string) => {
    switch (type) {
      case 'ride_group':
        return <MaterialIcon name="directions-car" size={16} color={colors.primary} />;
      case 'delivery_group':
        return <MaterialIcon name="local-shipping" size={16} color={colors.warning} />;
      case 'emergency_group':
        return <MaterialIcon name="emergency" size={16} color={colors.error} />;
      default:
        return <MaterialIcon name="group" size={16} color={colors.textSecondary} />;
    }
  };

  const getLastMessagePreview = () => {
    if (!groupChat.lastMessage) {
      return 'No messages yet';
    }

    const { content, type, senderName } = groupChat.lastMessage;
    
    switch (type) {
      case 'image':
        return `${senderName}: 📷 Photo`;
      case 'video':
        return `${senderName}: 🎥 Video`;
      case 'audio':
        return `${senderName}: 🎵 Audio`;
      case 'file':
        return `${senderName}: 📎 File`;
      case 'location':
        return `${senderName}: 📍 Location`;
      case 'poll':
        return `${senderName}: 📊 Poll`;
      case 'announcement':
        return `${senderName}: 📢 ${content}`;
      case 'system':
        return content;
      default:
        return content.length > 50 ? `${content.substring(0, 50)}...` : content;
    }
  };

  const renderAvatar = () => {
    if (groupChat.avatarUrl) {
      return (
        <Image source={{ uri: groupChat.avatarUrl }} style={styles.avatar} />
      );
    }

    return (
      <View style={[styles.avatar, styles.avatarPlaceholder]}>
        <Text style={styles.avatarText}>
          {groupChat.name.substring(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatarContainer}>
        {renderAvatar()}
        {groupChat.isOnline && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {getGroupTypeIcon(groupChat.type)}
            <Text style={styles.groupName} numberOfLines={1}>
              {groupChat.name}
            </Text>
          </View>
          
          <View style={styles.rightHeader}>
            {groupChat.lastMessage && (
              <Text style={styles.timeText}>
                {formatTime(groupChat.lastMessage.createdAt)}
              </Text>
            )}
            {groupChat.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {groupChat.unreadCount > 99 ? '99+' : groupChat.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text 
            style={[
              styles.lastMessage,
              groupChat.unreadCount > 0 && styles.lastMessageUnread,
            ]} 
            numberOfLines={1}
          >
            {getLastMessagePreview()}
          </Text>
          
          <View style={styles.participantInfo}>
            <Icon name="people" size={12} color={colors.textSecondary} />
            <Text style={styles.participantCount}>
              {groupChat.participantCount}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.body,
    color: colors.white,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupName: {
    fontSize: typography.fontSize.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginLeft: spacing.xs,
    flex: 1,
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  unreadText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  lastMessageUnread: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantCount: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginLeft: 2,
  },
});

export default GroupChatListItem;