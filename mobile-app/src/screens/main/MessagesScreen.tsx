/**
 * @fileoverview Messages screen for user messaging and conversations
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  SafeAreaView,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppSelector } from '../../store/hooks';
import { MessagesScreenProps } from '../../navigation/types';
import { useSocketEvent } from '../../hooks/useSocket';
import logger from '../../services/LoggingService';

const log = logger.createLogger('MessagesScreen');

interface Message {
  id: string;
  type: 'ride' | 'booking' | 'courier' | 'support';
  title: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  avatar?: string;
  participantName: string;
  rideId?: string;
  bookingId?: string;
  isOnline?: boolean;
  routeOrigin?: string;
  routeDestination?: string;
}

const MessagesScreen: React.FC<MessagesScreenProps> = ({ navigation }) => {
  const { profile: user } = useAppSelector((state) => state.user);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'ride' | 'booking' | 'courier' | 'support'>('all');

  // Listen for new incoming messages via socket
  useSocketEvent('new_message', (data: Record<string, unknown>) => {
    if (data?.chatId || data?.rideId) {
      const chatKey = (data.chatId as string) || `ride_${data.rideId}`;
      setMessages(prev => prev.map(msg => {
        if (msg.id === chatKey || msg.rideId === (data.rideId as string)) {
          return {
            ...msg,
            lastMessage: (data.message as string) || (data.content as string) || msg.lastMessage,
            timestamp: (data.timestamp as string) || new Date().toISOString(),
            unreadCount: msg.unreadCount + 1,
          };
        }
        return msg;
      }));
    }
  });

  // Listen for online status updates
  useSocketEvent('online_users', (data: Record<string, unknown>) => {
    if (data?.users) {
      const onlineUsers = data.users as string[];
      setMessages(prev => prev.map(msg => ({
        ...msg,
        isOnline: onlineUsers.includes(msg.id),
      })));
    }
  });

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async (): Promise<void> => {
    // Mock data — replace with actual API call
    const mockMessages: Message[] = [
      {
        id: '1',
        type: 'ride',
        title: 'Gaborone to Francistown',
        lastMessage: 'I\'ll pick you up at Game City in 5 minutes',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        unreadCount: 2,
        participantName: 'Thabo Mokoena',
        rideId: 'ride-123',
        isOnline: true,
        routeOrigin: 'Gaborone',
        routeDestination: 'Francistown',
      },
      {
        id: '2',
        type: 'booking',
        title: 'Maun to Kasane',
        lastMessage: 'Thank you for the ride! Safe travels.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        unreadCount: 0,
        participantName: 'Kelebogile Motswana',
        bookingId: 'booking-456',
        isOnline: false,
        routeOrigin: 'Maun',
        routeDestination: 'Kasane',
      },
      {
        id: '3',
        type: 'ride',
        title: 'Gaborone to Palapye',
        lastMessage: 'Are you still offering this ride tomorrow?',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        unreadCount: 1,
        participantName: 'Mpho Radebe',
        rideId: 'ride-789',
        isOnline: true,
        routeOrigin: 'Gaborone',
        routeDestination: 'Palapye',
      },
      {
        id: '5',
        type: 'courier',
        title: 'Package to Serowe',
        lastMessage: 'Package has been picked up',
        timestamp: new Date(Date.now() - 43200000).toISOString(),
        unreadCount: 0,
        participantName: 'Lesego Moagi',
        rideId: 'pkg-321',
        isOnline: false,
        routeOrigin: 'Gaborone',
        routeDestination: 'Serowe',
      },
      {
        id: '4',
        type: 'support',
        title: 'Hitch Support',
        lastMessage: 'Your issue has been resolved. Let us know if you need further assistance.',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        unreadCount: 0,
        participantName: 'Support Team',
        isOnline: false,
      },
    ];

    setMessages(mockMessages);
  };

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await loadMessages();
    setIsRefreshing(false);
  };

  const handleMessagePress = (message: Message): void => {
    // Navigate to chat screen
    (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('Chat', {
      chatId: message.id,
      recipientName: message.participantName,
      rideId: message.rideId,
      bookingId: message.bookingId,
    });
  };

  const handleNewMessage = (): void => {
    // Navigate to new message screen or show contacts
    log.info('Create new message');
  };

  const handleDeleteMessage = (messageId: string): void => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' as const },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
          }
        }
      ]
    );
  };

  const handleMessageLongPress = (message: Message): void => {
    const actions = [
      {
        text: 'Delete Conversation',
        style: 'destructive' as const,
        onPress: () => handleDeleteMessage(message.id)
      },
      {
        text: 'Mark as Unread',
        onPress: () => {
          setMessages(prev => prev.map(msg => 
            msg.id === message.id 
              ? { ...msg, unreadCount: Math.max(1, msg.unreadCount) }
              : msg
          ));
        }
      },
      {
        text: 'Mute Conversation',
        onPress: () => {
          Alert.alert('Muted', `${message.participantName} conversation has been muted.`);
        }
      },
      { text: 'Cancel', style: 'cancel' as const }
    ];
    
    Alert.alert('Message Options', 'Choose an action', actions);
  };

  const handleClearAllSampleMessages = (): void => {
    Alert.alert(
      'Clear All Messages',
      'This will remove all sample/demo messages. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' as const },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            Alert.alert('Cleared', 'All sample messages have been removed.');
          }
        }
      ]
    );
  };

  const getFilteredMessages = (): Message[] => {
    let filtered = messages;

    // Apply type filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(msg => msg.type === activeFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(msg =>
        msg.participantName.toLowerCase().includes(query) ||
        msg.title.toLowerCase().includes(query) ||
        msg.lastMessage.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const formatTimestamp = (timestamp: string): string => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffMs = now.getTime() - messageTime.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return messageTime.toLocaleDateString();
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'ride': return 'drive-eta';
      case 'booking': return 'person';
      case 'courier': return 'local-shipping';
      case 'support': return 'support-agent';
      default: return 'message';
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'ride': return '#2196F3';
      case 'booking': return '#FF9800';
      case 'courier': return '#9C27B0';
      case 'support': return '#4CAF50';
      default: return '#666666';
    }
  };

  const renderFilterBar = (): React.JSX.Element => (
    <View style={styles.filterBar}>
      {(['all', 'ride', 'booking', 'courier', 'support'] as const).map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.filterChip,
            activeFilter === filter && styles.activeFilterChip,
          ]}
          onPress={() => setActiveFilter(filter)}
        >
          <Icon
            name={filter === 'all' ? 'all-inbox' : getTypeIcon(filter)}
            size={16}
            color={activeFilter === filter ? '#FFFFFF' : '#666666'}
          />
          <Text
            style={[
              styles.filterChipText,
              activeFilter === filter && styles.activeFilterChipText,
            ]}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderRightActions = (messageId: string) => {
    return (
      <Animated.View style={styles.deleteAction}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteMessage(messageId)}
        >
          <Icon name="delete" size={24} color="#FFFFFF" />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderMessageItem = ({ item }: { item: Message }): React.JSX.Element => (
    <Swipeable
      renderRightActions={() => renderRightActions(item.id)}
      rightThreshold={40}
    >
      <TouchableOpacity
        style={styles.messageItem}
        onPress={() => handleMessagePress(item)}
        onLongPress={() => handleMessageLongPress(item)}
        activeOpacity={0.8}
        delayLongPress={500}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: getTypeColor(item.type) }]}>
            <Text style={styles.avatarText}>
              {item.participantName.charAt(0)}
            </Text>
          </View>
          {item.isOnline && <View style={styles.onlineIndicator} />}
          <View style={[styles.typeIndicator, { backgroundColor: getTypeColor(item.type) }]}>
            <Icon name={getTypeIcon(item.type)} size={10} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text style={styles.participantName} numberOfLines={1}>
              {item.participantName}
            </Text>
            <View style={styles.messageTime}>
              <Text style={styles.timestampText}>
                {formatTimestamp(item.timestamp)}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {item.routeOrigin && item.routeDestination ? (
            <View style={styles.routeRow}>
              <Icon name="radio-button-checked" size={10} color="#4CAF50" />
              <Text style={styles.routeText} numberOfLines={1}>
                {item.routeOrigin}
              </Text>
              <Icon name="arrow-forward" size={10} color="#999999" />
              <Icon name="location-on" size={10} color="#F44336" />
              <Text style={styles.routeText} numberOfLines={1}>
                {item.routeDestination}
              </Text>
            </View>
          ) : (
            <Text style={styles.messageTitle} numberOfLines={1}>
              {item.title}
            </Text>
          )}

          <Text
            style={[
              styles.lastMessage,
              item.unreadCount > 0 && styles.unreadLastMessage,
            ]}
            numberOfLines={2}
          >
            {item.lastMessage}
          </Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  const renderEmptyState = (): React.JSX.Element => (
    <View style={styles.emptyState}>
      <Icon name="message" size={64} color="#CCCCCC" />
      <Text style={styles.emptyStateTitle}>No messages yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Start a conversation with drivers or passengers from your rides
      </Text>
    </View>
  );

  const filteredMessages = getFilteredMessages();

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color="#666666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Icon name="clear" size={20} color="#666666" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.newMessageButton} onPress={handleNewMessage}>
          <Icon name="add" size={20} color="#2196F3" />
        </TouchableOpacity>
        
        {messages.length > 0 && (
          <TouchableOpacity 
            style={styles.clearAllButton} 
            onPress={handleClearAllSampleMessages}
          >
            <Icon name="delete-sweep" size={20} color="#FF5722" />
          </TouchableOpacity>
        )}
      </View>

      {renderFilterBar()}

      {/* Messages List */}
      <FlatList
        data={filteredMessages}
        renderItem={renderMessageItem}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={filteredMessages.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  newMessageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearAllButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    gap: 4,
  },
  activeFilterChip: {
    backgroundColor: '#2196F3',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },
  activeFilterChipText: {
    color: '#FFFFFF',
  },
  messagesList: {
    flex: 1,
  },
  messageItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  typeIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  messageContent: {
    flex: 1,
    gap: 4,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  messageTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timestampText: {
    fontSize: 12,
    color: '#666666',
  },
  unreadBadge: {
    backgroundColor: '#FF5722',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  messageTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  lastMessage: {
    fontSize: 14,
    color: '#999999',
    lineHeight: 18,
  },
  unreadLastMessage: {
    color: '#333333',
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 76,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteAction: {
    flex: 1,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default MessagesScreen;