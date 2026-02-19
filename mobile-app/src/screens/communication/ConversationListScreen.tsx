/**
 * @fileoverview Conversation list screen showing all active chats
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import logger from '../../services/LoggingService';

const log = logger.createLogger('ConversationListScreen');

interface Conversation {
  id: string;
  packageId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserType: 'courier' | 'sender';
  lastMessage: {
    text: string;
    timestamp: string;
    senderId: string;
    messageType: 'text' | 'image' | 'location' | 'system';
  };
  unreadCount: number;
  isOnline: boolean;
  deliveryStatus: 'pending' | 'in_progress' | 'delivered' | 'cancelled';
  packageTitle: string;
  avatar?: string;
}

const ConversationListScreen: React.FC = () => {
  const navigation = useNavigation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId] = useState('user_123'); // From auth context

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      
      // Mock data - in production, fetch from API
      const mockConversations: Conversation[] = [
        {
          id: 'conv_001',
          packageId: 'pkg_001',
          otherUserId: 'courier_456',
          otherUserName: 'John Driver',
          otherUserType: 'courier',
          lastMessage: {
            text: 'I\'ve arrived at the pickup location',
            timestamp: '2025-01-25T10:00:00Z',
            senderId: 'courier_456',
            messageType: 'text',
          },
          unreadCount: 2,
          isOnline: true,
          deliveryStatus: 'in_progress',
          packageTitle: 'Electronics Package',
        },
        {
          id: 'conv_002',
          packageId: 'pkg_002',
          otherUserId: 'courier_789',
          otherUserName: 'Sarah Wilson',
          otherUserType: 'courier',
          lastMessage: {
            text: 'Package delivered successfully',
            timestamp: '2025-01-24T16:30:00Z',
            senderId: 'courier_789',
            messageType: 'text',
          },
          unreadCount: 0,
          isOnline: false,
          deliveryStatus: 'delivered',
          packageTitle: 'Documents',
        },
        {
          id: 'conv_003',
          packageId: 'pkg_003',
          otherUserId: 'sender_321',
          otherUserName: 'Mike Chen',
          otherUserType: 'sender',
          lastMessage: {
            text: 'Package is ready for pickup',
            timestamp: '2025-01-25T08:15:00Z',
            senderId: 'sender_321',
            messageType: 'text',
          },
          unreadCount: 1,
          isOnline: true,
          deliveryStatus: 'pending',
          packageTitle: 'Gift Box',
        },
      ];

      setConversations(mockConversations);
    } catch (error) {
      log.error('Error loading conversations:', error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadConversations();
    } finally {
      setRefreshing(false);
    }
  };

  const handleConversationPress = (conversation: Conversation) => {
    // Mark as read
    markConversationAsRead(conversation.id);
    
    // Navigate to chat screen
    (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('ChatScreen', {
      packageId: conversation.packageId,
      otherUserId: conversation.otherUserId,
      otherUserName: conversation.otherUserName,
      otherUserType: conversation.otherUserType,
      deliveryStatus: conversation.deliveryStatus,
    });
  };

  const markConversationAsRead = (conversationId: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === conversationId
          ? { ...conv, unreadCount: 0 }
          : conv
      )
    );
  };

  const formatLastMessageTime = (timestamp: string) => {
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - messageDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return messageDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getDeliveryStatusColor = (status: Conversation['deliveryStatus']) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'in_progress': return colors.primary;
      case 'delivered': return colors.success;
      case 'cancelled': return colors.error;
      default: return colors.text.secondary;
    }
  };

  const getDeliveryStatusText = (status: Conversation['deliveryStatus']) => {
    switch (status) {
      case 'pending': return 'Pending Pickup';
      case 'in_progress': return 'In Transit';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return 'Unknown';
    }
  };

  const getLastMessagePreview = (conversation: Conversation) => {
    const { lastMessage } = conversation;
    const isOwnMessage = lastMessage.senderId === currentUserId;
    const prefix = isOwnMessage ? 'You: ' : '';

    switch (lastMessage.messageType) {
      case 'image':
        return `${prefix}📷 Image`;
      case 'location':
        return `${prefix}📍 Location`;
      case 'system':
        return lastMessage.text;
      default:
        return `${prefix}${lastMessage.text}`;
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[
        styles.conversationItem,
        item.unreadCount > 0 && styles.unreadConversation,
      ]}
      onPress={() => handleConversationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[
            styles.avatarPlaceholder,
            { backgroundColor: item.otherUserType === 'courier' ? colors.primary + '20' : colors.success + '20' }
          ]}>
            <Text style={[
              styles.avatarText,
              { color: item.otherUserType === 'courier' ? colors.primary : colors.success }
            ]}>
              {item.otherUserName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={[
            styles.userName,
            item.unreadCount > 0 && styles.unreadText,
          ]}>
            {item.otherUserName}
          </Text>
          <Text style={styles.timestamp}>
            {formatLastMessageTime(item.lastMessage.timestamp)}
          </Text>
        </View>

        <View style={styles.packageInfo}>
          <Text style={styles.packageTitle} numberOfLines={1}>
            {item.packageTitle}
          </Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getDeliveryStatusColor(item.deliveryStatus) + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: getDeliveryStatusColor(item.deliveryStatus) }
            ]}>
              {getDeliveryStatusText(item.deliveryStatus)}
            </Text>
          </View>
        </View>

        <View style={styles.lastMessageContainer}>
          <Text
            style={[
              styles.lastMessage,
              item.unreadCount > 0 && styles.unreadText,
            ]}
            numberOfLines={1}
          >
            {getLastMessagePreview(item)}
          </Text>
          
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="chat-bubble-outline" size={64} color={colors.text.secondary} />
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>
        Your conversations with couriers and senders will appear here
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Messages</Text>
      <TouchableOpacity onPress={() => Alert.alert('Search', 'Search functionality coming soon')}>
        <Icon name="search" size={24} color={colors.text.primary} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <FlatList
        data={conversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  listContent: {
    flexGrow: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  unreadConversation: {
    backgroundColor: colors.primary + '05',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  timestamp: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  packageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageTitle: {
    fontSize: 12,
    color: colors.text.secondary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
    marginRight: 8,
  },
  unreadText: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 12,
    color: colors.text.inverse,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
});

export default ConversationListScreen;