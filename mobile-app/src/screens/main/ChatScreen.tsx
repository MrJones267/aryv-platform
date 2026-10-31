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
import SocketService from '../../services/SocketService';
import locationService from '../../services/LocationService';
import logger from '../../services/LoggingService';
import chatApi, { ReportReason } from '../../services/api/chatApi';
import { useI18n } from '../../i18n/I18nContext';

// A chat's id, as opposed to `ride-<id>`.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    address?: string;
  };
}

const ChatScreen: React.FC<ChatScreenProps> = ({ navigation, route }) => {
  const { t } = useI18n();
  const { chatId, recipientName } = route.params;
  const rideId = (route.params as Record<string, unknown>)?.rideId as string | undefined;
  const bookingId = (route.params as Record<string, unknown>)?.bookingId as string | undefined;
  const otherUserId = (route.params as Record<string, unknown>)?.recipientId as string | undefined;
  // Ride details and booking open a ride's chat by ride. That used to pass
  // `ride-<id>` straight through as if it were a chat, so the chat never
  // loaded, and messages went over the socket only and were never saved.
  const rideForChat = rideId ?? (chatId?.startsWith('ride-') ? chatId.slice(5) : undefined);
  const [groupChatId, setGroupChatId] = useState<string | null>(UUID.test(chatId ?? '') ? chatId : null);
  const [chatError, setChatError] = useState<string | null>(null);
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
    typing: typingUsers,
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

  }, []);

  // Find (or make) the ride's chat when opened from a ride.
  useEffect(() => {
    if (groupChatId || !rideForChat) {
      if (!groupChatId) {setChatError(t('chat.notAvailable'));}
      return;
    }
    chatApi.openRideChat(rideForChat)
      .then(res => (res.success && res.data ? setGroupChatId(res.data.groupChatId) : setChatError(res.error || t('chat.notAvailable'))))
      .catch(() => setChatError(t('chat.notAvailable')));
  }, [rideForChat]);

  useEffect(() => {
    if (groupChatId) {loadMessages(groupChatId);}
  }, [groupChatId]);

  // Live messages for this chat, from its room.
  useEffect(() => {
    if (!groupChatId || !connected) {return undefined;}
    SocketService.getInstance().emit('join_group_chat', { groupChatId });
    return () => SocketService.getInstance().emit('leave_group_chat', { groupChatId });
  }, [groupChatId, connected]);

  // People I have blocked: the server leaves their messages out of the
  // history, and live ones are dropped here.
  const blockedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    chatApi.listBlocks()
      .then(res => { blockedRef.current = new Set((res.data?.blocks ?? []).map(b => b.userId)); })
      .catch(() => {});
  }, []);

  useSocketEvent('group_message', (data: { groupChatId?: string; message?: Record<string, any> }) => {
    const m = data?.message;
    if (!m || data.groupChatId !== groupChatId || blockedRef.current.has(m.senderId)) {return;}
    setLocalMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, toChatMessage(m)]));
    scrollToBottom();
  }, [groupChatId]);

  const toChatMessage = (m: Record<string, any>): ChatMessage => ({
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName ?? recipientName,
    message: m.content ?? '',
    timestamp: m.timestamp ?? m.createdAt,
    type: (m.type === 'location' || m.type === 'system' ? m.type : 'text') as ChatMessage['type'],
    isRead: !!m.isRead,
    location: m.location ?? m.metadata?.location,
  });

  const loadMessages = async (id: string): Promise<void> => {
    try {
      const response = await chatApi.getGroupMessages(id, { limit: 50 });
      if (response.success && response.data?.messages) {
        // Oldest first, as the list is drawn.
        const history = response.data.messages.map(m => toChatMessage(m as unknown as Record<string, any>))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setLocalMessages(history);
        chatApi.markAsRead(id).catch(() => {});
      }
    } catch (error) {
      log.warn('Failed to load message history', { error: String(error) });
      // Silently fail — socket will still deliver new messages in real time
    }
  };

  /**
   * Show the message straight away, save it, then swap in the saved id so
   * the copy that comes back over the socket is not shown twice. If it
   * cannot be saved it is taken back off the screen and the person told.
   */
  const deliver = async (text: string, type: 'text' | 'location' = 'text', location?: ChatMessage['location']): Promise<void> => {
    if (!groupChatId) {
      Alert.alert(t('common.error'), chatError || t('chat.notAvailable'));
      return;
    }
    const tempId = `local-${Date.now()}`;
    setLocalMessages(prev => [...prev, {
      id: tempId, senderId: user?.id || 'current-user', senderName: user?.firstName || t('ui.you'),
      message: text, timestamp: new Date().toISOString(), type, isRead: false, location,
    }]);
    scrollToBottom();
    try {
      const res = await chatApi.sendGroupMessage(groupChatId, text, type, location ? { location } : undefined);
      if (!res.success || !res.data?.id) {throw new Error(res.error);}
      const savedId = res.data.id;
      setLocalMessages(prev => (prev.some(m => m.id === savedId)
        ? prev.filter(m => m.id !== tempId)
        : prev.map(m => (m.id === tempId ? { ...m, id: savedId } : m))));
    } catch {
      setLocalMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert(t('common.error'), t('ui.failedToSendMessage'));
    }
  };

  const handleSendMessage = (): void => {
    if (!newMessage.trim()) return;
    const text = newMessage.trim();
    setNewMessage('');
    deliver(text);

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

        await deliver(t('ui.sharedLocationMsg', { address: addressStr }), 'location', {
          latitude: location.latitude,
          longitude: location.longitude,
          address: addressStr,
        });
      } else {
        Alert.alert(t('ui.locationUnavailable'), t('ui.unableToGetYourCurrent'));
      }
    } catch (error) {
      log.error('Error sharing location:', error);
      Alert.alert(t('common.error'), t('ui.failedToShareLocationPlease'));
    } finally {
      setIsSharingLocation(false);
    }
  };

  const handleSendQuickMessage = (text: string): void => {
    setShowQuickActions(false);
    deliver(text);
  };

  const handleOpenLocationInMaps = (location: ChatMessage['location']): void => {
    if (!location) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${location.latitude},${location.longitude}`,
      android: `geo:${location.latitude},${location.longitude}?q=${location.latitude},${location.longitude}(${encodeURIComponent(location.address ?? '')})`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert(t('common.error'), t('ui.unableToOpenMapsApplication'));
      });
    }
  };

  // Reporting goes to ARYV's admins (POST /api/reports). "Report message"
  // used to thank the person and send nothing, and "Report user" told them
  // to contact support. Delete, clear history and block only changed this
  // phone's screen, so they are gone until they exist on the server.
  const chooseReason = (then: (reason: ReportReason) => void): void => {
    Alert.alert(t('rp.whyTitle'), t('rp.whyBody'), [
      { text: t('rp.reason.harassment'), onPress: () => then('harassment') },
      { text: t('rp.reason.scam'), onPress: () => then('scam') },
      { text: t('rp.reason.inappropriate'), onPress: () => then('inappropriate') },
      { text: t('rp.reason.safety'), onPress: () => then('safety') },
      { text: t('rp.reason.spam'), onPress: () => then('spam') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const sendReport = async (body: { messageId?: string; reportedUserId?: string; reason: ReportReason }): Promise<void> => {
    try {
      const res = await chatApi.report(body);
      if (!res.success) {
        Alert.alert(t('common.error'), res.error || t('rp.failed'));
        return;
      }
      Alert.alert(t('rp.sentTitle'), res.data?.duplicate ? t('rp.alreadySent') : t('rp.sentBody'));
    } catch {
      Alert.alert(t('common.error'), t('rp.failed'));
    }
  };

  const handleMessageLongPress = (message: ChatMessage): void => {
    const isCurrentUser = message.senderId === user?.id || message.senderId === 'current-user';
    const isSystem = message.type === 'system';

    if (isSystem) return;

    const actions: Array<{ text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void }> = [];

    actions.push(
      {
        text: t('ui.copyMessage'),
        onPress: () => {
          Clipboard.setString(message.message);
          Alert.alert(t('ui.copied'), t('ui.messageCopiedToClipboard'));
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    );
    // You can report other people's messages, not your own.
    if (!isCurrentUser) {
      actions.splice(actions.length - 1, 0, {
        text: t('ui.reportMessage'),
        style: 'destructive' as const,
        onPress: () => chooseReason(reason => sendReport({ messageId: message.id, reason })),
      });
    }

    Alert.alert(t('messagesList.options'), t('messagesList.chooseAction'), actions);
  };

  const handleMoreOptions = (): void => {
    Alert.alert(
      t('ui.options'),
      t('messagesList.chooseAction'),
      [
        { text: t('ui.shareLocation'), onPress: handleShareLocation },
        ...(otherUserId ? [{ text: t('ui.reportUser'), onPress: handleReportUser, style: 'destructive' as const }] : []),
        ...(otherUserId ? [{ text: t('ui.blockUser'), onPress: handleBlockUser, style: 'destructive' as const }] : []),
        { text: t('common.cancel'), style: 'cancel' as const },
      ],
    );
  };

  // Blocking stops the two booking each other's rides and hides their
  // messages from you. It used to say so and only leave the screen.
  const handleBlockUser = (): void => {
    if (!otherUserId) {return;}
    Alert.alert(t('ui.blockUser'), t('blk.confirm', { name: recipientName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ui.block'),
        style: 'destructive',
        onPress: async () => {
          const res = await chatApi.block(otherUserId);
          if (!res.success) {
            Alert.alert(t('common.error'), res.error || t('blk.failed'));
            return;
          }
          Alert.alert(t('blk.doneTitle'), t('blk.doneBody', { name: recipientName }), [
            { text: t('common.ok'), onPress: () => navigation.goBack() },
          ]);
        },
      },
    ]);
  };

  const handleReportUser = (): void => {
    if (otherUserId) {chooseReason(reason => sendReport({ reportedUserId: otherUserId, reason }));}
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
    { icon: 'schedule', label: t('ui.onMyWay'), message: t('ui.onMyWayMsg') },
    { icon: 'hourglass-empty', label: t('ui.runningLate'), message: t('ui.runningLateMsg') },
    { icon: 'check-circle', label: t('ui.imHere'), message: t('ui.arrivedPickupMsg') },
    { icon: 'thumb-up', label: t('ui.thanks'), message: t('ui.thankYouSeeYouSoon') },
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
          {bookingId ? t('messagesList.filter.booking') : t('messagesList.filter.ride')} conversation
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
            {isSharingLocation ? t('ui.gettingLocation') : t('ui.shareMyLocation')}
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
              {t('ui.tapToOpenInMaps')}
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
          placeholder={t('messages.typeMessage')}
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
                {isOnline ? `${recipientName} is online` : t('ui.offline')}
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
        {chatError && !groupChatId && (
          <Text style={styles.chatError}>{chatError}</Text>
        )}
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
  chatError: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FDECEA',
    color: '#B71C1C',
    fontSize: 14,
    textAlign: 'center',
  },
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
