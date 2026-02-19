/**
 * @fileoverview Chat screen for driver-passenger communication
 * Integrates with Socket.io for real-time messaging and ride context
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Clipboard,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppSelector } from '../../store/hooks';
import { ChatScreenProps } from '../../navigation/types';
import { useSocket, useSocketEvent, useChatMessages } from '../../hooks/useSocket';
import locationService from '../../services/LocationService';
import logger from '../../services/LoggingService';

const log = logger.createLogger('ChatScreen');

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
  type: 'text' | 'system' | 'location';
  isRead: boolean;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

const ChatScreen: React.FC<ChatScreenProps> = ({ navigation, route }) => {
  const { chatId, recipientName } = route.params;
  const rideId = (route.params as Record<string, unknown>)?.rideId as string | undefined;
  const bookingId = (route.params as Record<string, unknown>)?.bookingId as string | undefined;
  const { profile: user } = useAppSelector((state) => state.user);

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Socket integration
  const { connected, joinRide, leaveRide } = useSocket();
  const chatRoom = rideId || chatId;
  const {
    messages: socketMessages,
    typing: typingUsers,
    sendMessage: sendSocketMessage,
    sendTyping: sendSocketTyping,
  } = useChatMessages(chatRoom);

  // Join ride room on mount
  useEffect(() => {
    if (chatRoom && connected) {
      joinRide(chatRoom);
    }
    return () => {
      if (chatRoom) {
        leaveRide(chatRoom);
      }
    };
  }, [chatRoom, connected]);

  // Listen for online status
  useSocketEvent('online_users', (data: Record<string, unknown>) => {
    if (data?.users) {
      const recipientId = (route.params as Record<string, unknown>)?.recipientId as string | undefined;
      setIsOnline((data.users as string[]).includes(recipientId || ''));
    }
  });

  // Merge socket messages into local state
  useEffect(() => {
    if (socketMessages.length > 0) {
      const newSocketMsgs: ChatMessage[] = socketMessages
        .filter((sm: Record<string, unknown>) => !localMessages.find(lm => lm.id === sm.id))
        .map((sm: Record<string, unknown>) => ({
          id: (sm.id as string) || Date.now().toString(),
          senderId: (sm.senderId as string) || (sm.userId as string) || '',
          senderName: (sm.senderName as string) || recipientName,
          message: (sm.message as string) || (sm.content as string) || '',
          timestamp: (sm.timestamp as string) || new Date().toISOString(),
          type: (sm.type as ChatMessage['type']) || 'text',
          isRead: false,
          location: sm.location as ChatMessage['location'],
        }));

      if (newSocketMsgs.length > 0) {
        setLocalMessages(prev => [...prev, ...newSocketMsgs]);
        scrollToBottom();
      }
    }
  }, [socketMessages]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: recipientName,
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleMoreOptions}>
            <Icon name="more-vert" size={24} color="#666666" />
          </TouchableOpacity>
        </View>
      ),
    });

    loadMessages();
  }, []);

  const loadMessages = (): void => {
    // Initial mock messages — these would be fetched from API in production
    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        senderId: 'other-user-id',
        senderName: recipientName,
        message: 'Hi! I\'m interested in your ride.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        type: 'text',
        isRead: true,
      },
      {
        id: '2',
        senderId: user?.id || 'current-user',
        senderName: user?.firstName || 'You',
        message: 'Great! I have seats available. When do you need to leave?',
        timestamp: new Date(Date.now() - 3300000).toISOString(),
        type: 'text',
        isRead: true,
      },
      {
        id: '3',
        senderId: 'other-user-id',
        senderName: recipientName,
        message: 'Around 5 PM would be perfect. Where should we meet?',
        timestamp: new Date(Date.now() - 3000000).toISOString(),
        type: 'text',
        isRead: true,
      },
      {
        id: '4',
        senderId: user?.id || 'current-user',
        senderName: user?.firstName || 'You',
        message: 'How about the main entrance of the mall?',
        timestamp: new Date(Date.now() - 2700000).toISOString(),
        type: 'text',
        isRead: true,
      },
      {
        id: '5',
        senderId: 'system',
        senderName: 'System',
        message: `${recipientName} has booked this ride`,
        timestamp: new Date(Date.now() - 2400000).toISOString(),
        type: 'system',
        isRead: true,
      },
      {
        id: '6',
        senderId: 'other-user-id',
        senderName: recipientName,
        message: 'Perfect! See you there at 5 PM.',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: 'text',
        isRead: false,
      },
    ];

    setLocalMessages(mockMessages);
  };

  const handleSendMessage = (): void => {
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      senderId: user?.id || 'current-user',
      senderName: user?.firstName || 'You',
      message: newMessage.trim(),
      timestamp: new Date().toISOString(),
      type: 'text',
      isRead: false,
    };

    setLocalMessages(prev => [...prev, message]);
    setNewMessage('');

    // Send via socket
    if (connected && chatRoom) {
      sendSocketMessage(newMessage.trim(), 'text');
    }

    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (connected && chatRoom) {
      sendSocketTyping(false);
    }

    scrollToBottom();
  };

  const handleTextChange = (text: string): void => {
    setNewMessage(text);

    // Send typing indicator via socket
    if (connected && chatRoom) {
      sendSocketTyping(true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendSocketTyping(false);
      }, 2000);
    }
  };

  const handleShareLocation = async (): Promise<void> => {
    setIsSharingLocation(true);
    try {
      const location = await locationService.getCurrentLocation();
      if (location) {
        const addressData = await locationService.reverseGeocode(
          location.latitude,
          location.longitude,
        );
        const addressStr = addressData?.fullAddress || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;

        const locationMsg: ChatMessage = {
          id: Date.now().toString(),
          senderId: user?.id || 'current-user',
          senderName: user?.firstName || 'You',
          message: `📍 Shared location: ${addressStr}`,
          timestamp: new Date().toISOString(),
          type: 'location',
          isRead: false,
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            address: addressStr,
          },
        };

        setLocalMessages(prev => [...prev, locationMsg]);

        if (connected && chatRoom) {
          sendSocketMessage(locationMsg.message, 'location');
        }

        scrollToBottom();
      } else {
        Alert.alert('Location Unavailable', 'Unable to get your current location. Please check location permissions.');
      }
    } catch (error) {
      log.error('Error sharing location:', error);
      Alert.alert('Error', 'Failed to share location. Please try again.');
    } finally {
      setIsSharingLocation(false);
    }
  };

  const handleSendQuickMessage = (text: string): void => {
    setShowQuickActions(false);
    const message: ChatMessage = {
      id: Date.now().toString(),
      senderId: user?.id || 'current-user',
      senderName: user?.firstName || 'You',
      message: text,
      timestamp: new Date().toISOString(),
      type: 'text',
      isRead: false,
    };

    setLocalMessages(prev => [...prev, message]);

    if (connected && chatRoom) {
      sendSocketMessage(text, 'text');
    }

    scrollToBottom();
  };

  const handleOpenLocationInMaps = (location: ChatMessage['location']): void => {
    if (!location) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${location.latitude},${location.longitude}`,
      android: `geo:${location.latitude},${location.longitude}?q=${location.latitude},${location.longitude}(${encodeURIComponent(location.address)})`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Unable to open maps application.');
      });
    }
  };

  const handleDeleteMessage = async (messageId: string): Promise<void> => {
    setLocalMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  const handleMessageLongPress = (message: ChatMessage): void => {
    const isCurrentUser = message.senderId === user?.id || message.senderId === 'current-user';
    const isSystem = message.type === 'system';

    if (isSystem) return;

    const actions: Array<{ text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void }> = [];

    if (isCurrentUser) {
      actions.push({
        text: 'Delete Message',
        style: 'destructive' as const,
        onPress: () => {
          Alert.alert(
            'Delete Message',
            'Are you sure you want to delete this message?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => handleDeleteMessage(message.id),
              },
            ],
          );
        },
      });
    }

    actions.push(
      {
        text: 'Copy Message',
        onPress: () => {
          Clipboard.setString(message.message);
          Alert.alert('Copied', 'Message copied to clipboard');
        },
      },
      {
        text: 'Report Message',
        style: 'destructive' as const,
        onPress: () => {
          Alert.alert('Report Message', 'Thank you for reporting. We will review this message.');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    );

    Alert.alert('Message Options', 'Choose an action', actions);
  };

  const handleMoreOptions = (): void => {
    Alert.alert(
      'Options',
      'Choose an action',
      [
        { text: 'Share Location', onPress: handleShareLocation },
        { text: 'Clear Chat History', onPress: handleClearChat, style: 'destructive' },
        { text: 'Report User', onPress: handleReportUser, style: 'destructive' },
        { text: 'Block User', onPress: handleBlockUser, style: 'destructive' },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleClearChat = (): void => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to clear all messages? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            setLocalMessages([]);
          },
        },
      ],
    );
  };

  const handleReportUser = (): void => {
    Alert.alert('Report User', 'Please contact support to report this user.');
  };

  const handleBlockUser = (): void => {
    Alert.alert(
      'Block User',
      'Are you sure you want to block this user? You won\'t be able to receive messages from them.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => navigation.goBack() },
      ],
    );
  };

  const scrollToBottom = (): void => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const quickActions = [
    { icon: 'schedule', label: 'On my way', message: "I'm on my way!" },
    { icon: 'hourglass-empty', label: 'Running late', message: "I'm running a few minutes late, sorry!" },
    { icon: 'check-circle', label: 'I\'m here', message: "I've arrived at the pickup point." },
    { icon: 'thumb-up', label: 'Thanks', message: 'Thank you! See you soon.' },
  ];

  const renderRideContext = (): React.ReactNode => {
    if (!rideId && !bookingId) return null;

    return (
      <TouchableOpacity
        style={styles.rideContext}
        onPress={() => {
          if (rideId) {
            (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('RideDetails', { rideId });
          }
        }}
      >
        <Icon name="directions-car" size={16} color="#2196F3" />
        <Text style={styles.rideContextText} numberOfLines={1}>
          {bookingId ? 'Booking' : 'Ride'} conversation
        </Text>
        <Icon name="chevron-right" size={16} color="#999999" />
      </TouchableOpacity>
    );
  };

  const renderQuickActions = (): React.ReactNode => {
    if (!showQuickActions) return null;

    return (
      <View style={styles.quickActionsContainer}>
        <View style={styles.quickActionsRow}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickActionButton}
              onPress={() => handleSendQuickMessage(action.message)}
            >
              <Icon name={action.icon} size={18} color="#2196F3" />
              <Text style={styles.quickActionText} numberOfLines={1}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.quickActionShareLocation}
          onPress={handleShareLocation}
          disabled={isSharingLocation}
        >
          {isSharingLocation ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : (
            <Icon name="my-location" size={18} color="#2196F3" />
          )}
          <Text style={styles.quickActionText}>
            {isSharingLocation ? 'Getting location...' : 'Share my location'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }): React.JSX.Element => {
    const isCurrentUser = item.senderId === user?.id || item.senderId === 'current-user';
    const isSystem = item.type === 'system';
    const isLocation = item.type === 'location';
    const showTimestamp = index === 0 ||
      (localMessages[index - 1] &&
        new Date(item.timestamp).getTime() - new Date(localMessages[index - 1].timestamp).getTime() > 300000);

    if (isSystem) {
      return (
        <View key={item.id} style={styles.systemMessageContainer}>
          <View style={styles.systemMessage}>
            <Text style={styles.systemMessageText}>{item.message}</Text>
          </View>
          <Text style={styles.systemTimestamp}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>
      );
    }

    return (
      <View key={item.id} style={styles.messageContainer}>
        {showTimestamp && (
          <Text style={styles.timestampHeader}>
            {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.messageBubble,
            isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
            isLocation && styles.locationBubble,
          ]}
          onLongPress={() => handleMessageLongPress(item)}
          onPress={isLocation && item.location ? () => handleOpenLocationInMaps(item.location) : undefined}
          activeOpacity={0.8}
          delayLongPress={500}
        >
          {!isCurrentUser && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}

          {isLocation && item.location && (
            <View style={styles.locationPreview}>
              <Icon name="place" size={20} color={isCurrentUser ? '#FFFFFF' : '#2196F3'} />
              <Text style={[
                styles.locationAddress,
                isCurrentUser ? styles.currentUserText : styles.otherUserText,
              ]} numberOfLines={2}>
                {item.location.address}
              </Text>
            </View>
          )}

          {!isLocation && (
            <Text style={[
              styles.messageText,
              isCurrentUser ? styles.currentUserText : styles.otherUserText,
            ]}>
              {item.message}
            </Text>
          )}

          {isLocation && (
            <Text style={[
              styles.locationTapHint,
              { color: isCurrentUser ? 'rgba(255,255,255,0.6)' : '#999999' },
            ]}>
              Tap to open in maps
            </Text>
          )}

          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isCurrentUser ? styles.currentUserTime : styles.otherUserTime,
            ]}>
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {isCurrentUser && (
              <Icon
                name={item.isRead ? 'done-all' : 'done'}
                size={14}
                color={item.isRead ? '#81D4FA' : 'rgba(255,255,255,0.5)'}
              />
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderInputBar = (): React.JSX.Element => (
    <View style={styles.inputContainer}>
      <View style={styles.inputRow}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={() => setShowQuickActions(!showQuickActions)}
        >
          <Icon
            name={showQuickActions ? 'close' : 'add-circle-outline'}
            size={24}
            color={showQuickActions ? '#F44336' : '#666666'}
          />
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor="#999999"
          value={newMessage}
          onChangeText={handleTextChange}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSendMessage}
          blurOnSubmit={false}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            newMessage.trim() ? styles.sendButtonActive : styles.sendButtonInactive,
          ]}
          onPress={handleSendMessage}
          disabled={!newMessage.trim()}
        >
          <Icon
            name="send"
            size={20}
            color={newMessage.trim() ? '#FFFFFF' : '#CCCCCC'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Ride Context Banner */}
        {renderRideContext()}

        {/* Online Status */}
        <View style={styles.statusBar}>
          {connected ? (
            <View style={styles.onlineStatus}>
              <View style={[styles.statusDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
              <Text style={styles.statusText}>
                {isOnline ? `${recipientName} is online` : 'Offline'}
              </Text>
            </View>
          ) : (
            <View style={styles.onlineStatus}>
              <Icon name="cloud-off" size={14} color="#FF9800" />
              <Text style={[styles.statusText, { color: '#FF9800' }]}>
                Connecting...
              </Text>
            </View>
          )}
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={localMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
        />

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <View style={styles.typingContainer}>
            <View style={styles.typingDots}>
              <View style={[styles.dot, styles.dot1]} />
              <View style={[styles.dot, styles.dot2]} />
              <View style={[styles.dot, styles.dot3]} />
            </View>
            <Text style={styles.typingText}>{recipientName} is typing...</Text>
          </View>
        )}

        {/* Quick Actions */}
        {renderQuickActions()}

        {renderInputBar()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  rideContext: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
    gap: 8,
  },
  rideContextText: {
    flex: 1,
    fontSize: 13,
    color: '#1565C0',
    fontWeight: '500',
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineDot: {
    backgroundColor: '#4CAF50',
  },
  offlineDot: {
    backgroundColor: '#BDBDBD',
  },
  statusText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  messageContainer: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  timestampHeader: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999999',
    marginVertical: 16,
    backgroundColor: '#F5F5F5',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxWidth: '80%',
    marginVertical: 2,
  },
  currentUserBubble: {
    backgroundColor: '#2196F3',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: '#F0F0F0',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  locationBubble: {
    minWidth: '60%',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  currentUserText: {
    color: '#FFFFFF',
  },
  otherUserText: {
    color: '#333333',
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  locationAddress: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
  },
  locationTapHint: {
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  currentUserTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherUserTime: {
    color: '#999999',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessage: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '80%',
  },
  systemMessageText: {
    fontSize: 14,
    color: '#2196F3',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  systemTimestamp: {
    fontSize: 11,
    color: '#999999',
    marginTop: 4,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#BDBDBD',
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1.0 },
  typingText: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
  },
  quickActionsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 6,
  },
  quickActionShareLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
    gap: 6,
  },
  quickActionText: {
    fontSize: 13,
    color: '#333333',
    fontWeight: '500',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  attachButton: {
    padding: 8,
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
    color: '#333333',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: '#2196F3',
  },
  sendButtonInactive: {
    backgroundColor: '#F0F0F0',
  },
});

export default ChatScreen;
