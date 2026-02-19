/**
 * @fileoverview Group Chat Screen for enhanced messaging experience
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { GroupChatService } from '../services/GroupChatService';
import SocketService from '../services/SocketService';
// import { useAuth } from '../contexts/AuthContext';
const useAuth = () => ({ user: { id: 'mock-user', firstName: 'Mock', lastName: 'User' } });
import { colors, spacing, typography } from '../theme';
import { GroupChatMessage } from '../components/GroupChatMessage';
import { GroupTypingIndicator } from '../components/GroupTypingIndicator';
import { GroupParticipantsList } from '../components/GroupParticipantsList';
import { MessageReactionPicker } from '../components/MessageReactionPicker';
import { GroupCompletionBanner } from '../components/GroupCompletionBanner';
import logger from '../services/LoggingService';

const log = logger.createLogger('GroupChatScreen');

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface GroupChat {
  id: string;
  name: string;
  description?: string;
  type: string;
  participantCount: number;
  unreadCount: number;
  lastMessage?: unknown;
  isOnline?: boolean;
}

interface GroupMessage {
  id: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: string;
  isRead: boolean;
  reactions: Record<string, string[]>;
  isPinned: boolean;
  replyToMessage?: { sender: { firstName: string }; content: string };
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

interface RouteParams {
  groupChatId: string;
  groupName: string;
}

type GroupChatScreenRouteProp = RouteProp<{ GroupChat: RouteParams }, 'GroupChat'>;

export const GroupChatScreen: React.FC = () => {
  const route = useRoute<GroupChatScreenRouteProp>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { groupChatId, groupName } = route.params;

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Record<string, unknown>[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<GroupMessage | null>(null);
  const [showCompletionBanner, setShowCompletionBanner] = useState(false);
  const [rideCompletionData, setRideCompletionData] = useState<Record<string, unknown> | null>(null);
  const [voteData, setVoteData] = useState<Record<string, unknown> | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socketService = SocketService.getInstance();

  useEffect(() => {
    initializeGroupChat();
    setupSocketListeners();

    return () => {
      cleanup();
    };
  }, [groupChatId]);

  const initializeGroupChat = async () => {
    try {
      setLoading(true);
      
      // Join the group chat room
      socketService.emit('join_group_chat', { groupChatId });
      
      // Load messages
      await loadMessages();
      
      // Mark messages as read
      await GroupChatService.markMessagesAsRead(groupChatId);
      
    } catch (error) {
      log.error('Error initializing group chat:', error);
      Alert.alert('Error', 'Failed to load group chat');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await GroupChatService.getGroupMessages(groupChatId, {
        limit: 50,
        offset: 0,
      });
      
      if (response.success) {
        setMessages((response.data as unknown as { messages: GroupMessage[] })?.messages || []);
        scrollToBottom();
      }
    } catch (error) {
      log.error('Error loading messages:', error);
    }
  };

  const setupSocketListeners = () => {
    // Group message events
    socketService.on('group_message', handleNewMessage);
    socketService.on('group_message_read', handleMessageRead);
    socketService.on('message_reaction', handleMessageReaction);
    socketService.on('message_pinned', handleMessagePinned);
    
    // Typing indicators
    socketService.on('group_typing_start', handleTypingStart);
    socketService.on('group_typing_stop', handleTypingStop);
    
    // Participant events
    socketService.on('participant_joined', handleParticipantJoined);
    socketService.on('participant_left', handleParticipantLeft);
    socketService.on('participant_updated', handleParticipantUpdated);
    
    // Ride completion events
    socketService.on('ride_completed', handleRideCompleted);
    socketService.on('group_vote_update', handleGroupVoteUpdate);
    socketService.on('group_archived', handleGroupArchived);
    socketService.on('group_converted', handleGroupConverted);
  };

  const cleanup = () => {
    socketService.emit('leave_group_chat', { groupChatId });
    socketService.off('group_message', handleNewMessage);
    socketService.off('group_message_read', handleMessageRead);
    socketService.off('message_reaction', handleMessageReaction);
    socketService.off('message_pinned', handleMessagePinned);
    socketService.off('group_typing_start', handleTypingStart);
    socketService.off('group_typing_stop', handleTypingStop);
    socketService.off('participant_joined', handleParticipantJoined);
    socketService.off('participant_left', handleParticipantLeft);
    socketService.off('participant_updated', handleParticipantUpdated);
    socketService.off('ride_completed', handleRideCompleted);
    socketService.off('group_vote_update', handleGroupVoteUpdate);
    socketService.off('group_archived', handleGroupArchived);
    socketService.off('group_converted', handleGroupConverted);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleNewMessage = (data: { message: GroupMessage; groupChatId: string }) => {
    if (data.groupChatId === groupChatId) {
      setMessages(prev => [...prev, data.message]);
      scrollToBottom();
      
      // Mark as read if from another user
      if (data.message.senderId !== user?.id) {
        GroupChatService.markMessagesAsRead(groupChatId, data.message.id);
      }
    }
  };

  const handleMessageRead = (data: { userId: string; messageId?: string }) => {
    setMessages(prev => 
      prev.map(message => ({
        ...message,
        isRead: message.id === data.messageId || data.messageId === undefined ? true : message.isRead,
      }))
    );
  };

  const handleMessageReaction = (data: { messageId: string; reactions: Record<string, string[]> }) => {
    setMessages(prev => 
      prev.map(message => 
        message.id === data.messageId 
          ? { ...message, reactions: data.reactions }
          : message
      )
    );
  };

  const handleMessagePinned = (data: { messageId: string; isPinned: boolean }) => {
    setMessages(prev => 
      prev.map(message => 
        message.id === data.messageId 
          ? { ...message, isPinned: data.isPinned }
          : message
      )
    );
  };

  const handleTypingStart = (data: { userId: string; userName: string }) => {
    if (data.userId !== user?.id) {
      setTypingUsers(prev => [...prev.filter(id => id !== data.userId), data.userId]);
    }
  };

  const handleTypingStop = (data: { userId: string }) => {
    setTypingUsers(prev => prev.filter(id => id !== data.userId));
  };

  const handleParticipantJoined = (data: { participant: Record<string, unknown> }) => {
    // Update participants list
    setParticipants(prev => [...prev, data.participant]);
  };

  const handleParticipantLeft = (data: { userId: string }) => {
    setParticipants(prev => prev.filter(p => p.userId !== data.userId));
  };

  const handleParticipantUpdated = (data: { participant: Record<string, unknown> }) => {
    setParticipants(prev =>
      prev.map(p => p.id === data.participant.id ? data.participant : p)
    );
  };

  const handleRideCompleted = (data: { groupChatId: string; autoArchiveIn: number }) => {
    if (data.groupChatId === groupChatId) {
      setRideCompletionData(data);
      setShowCompletionBanner(true);
    }
  };

  const handleGroupVoteUpdate = (data: Record<string, unknown>) => {
    if (data.groupChatId === groupChatId) {
      setVoteData(data);
    }
  };

  const handleGroupArchived = (data: { groupChatId: string; reason: string }) => {
    if (data.groupChatId === groupChatId) {
      setShowCompletionBanner(false);
      Alert.alert(
        'Group Archived',
        'This group has been archived after trip completion. Chat history is preserved.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const handleGroupConverted = (data: { groupChatId: string; newType: string }) => {
    if (data.groupChatId === groupChatId) {
      setShowCompletionBanner(false);
      Alert.alert(
        'Group Converted',
        'This group has been converted to a custom group and will remain active.',
        [{ text: 'OK' }]
      );
    }
  };

  const sendMessage = async () => {
    if (newMessage.trim() === '') return;

    try {
      const messageData = {
        content: newMessage.trim(),
        type: 'text' as const,
        replyToMessageId: replyToMessage?.id,
      };

      await GroupChatService.sendMessage(groupChatId, messageData);
      
      setNewMessage('');
      setReplyToMessage(null);
      stopTyping();
      
    } catch (error) {
      log.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const startTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      socketService.emit('group_typing_start', { groupChatId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  };

  const stopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      socketService.emit('group_typing_stop', { groupChatId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const onInputChange = (text: string) => {
    setNewMessage(text);
    if (text.length > 0) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleMessagePress = (message: GroupMessage) => {
    setSelectedMessage(message.id);
    setShowReactionPicker(true);
  };

  const handleReaction = async (emoji: string) => {
    if (!selectedMessage) return;

    try {
      await GroupChatService.addReaction(selectedMessage, emoji);
      setShowReactionPicker(false);
      setSelectedMessage(null);
    } catch (error) {
      log.error('Error adding reaction:', error);
      Alert.alert('Error', 'Failed to add reaction');
    }
  };

  const handleReply = (message: GroupMessage) => {
    setReplyToMessage(message);
  };

  const renderMessage = ({ item }: { item: GroupMessage }) => (
    <GroupChatMessage
      message={item}
      currentUserId={user?.id}
      onPress={() => handleMessagePress(item)}
      onReply={() => handleReply(item)}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
      </TouchableOpacity>
      
      <View style={styles.headerCenter}>
        <Text style={styles.groupName}>{groupName}</Text>
        <Text style={styles.participantCount}>
          {participants.length} participants
        </Text>
      </View>
      
      <TouchableOpacity 
        style={styles.headerButton}
        onPress={() => setShowParticipants(true)}
      >
        <MaterialIcons name="group" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderInputArea = () => (
    <View style={styles.inputContainer}>
      {replyToMessage && (
        <View style={styles.replyContainer}>
          <Text style={styles.replyText}>
            Replying to {replyToMessage.sender.firstName}
          </Text>
          <TouchableOpacity onPress={() => setReplyToMessage(null)}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={onInputChange}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={1000}
        />
        
        <TouchableOpacity 
          style={[styles.sendButton, newMessage.trim() ? styles.sendButtonActive : null]}
          onPress={sendMessage}
          disabled={newMessage.trim() === ''}
        >
          <Ionicons 
            name="send" 
            size={20} 
            color={newMessage.trim() ? colors.white : colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading group chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {renderHeader()}
        
        {showCompletionBanner && rideCompletionData && (
          <GroupCompletionBanner
            groupChatId={groupChatId}
            autoArchiveIn={rideCompletionData.autoArchiveIn as number}
            currentVotes={voteData as { keepVotes: number; totalVotes: number; requiredVotes: number; userVote?: boolean } | undefined}
            onVoteUpdate={setVoteData}
            onDismiss={() => setShowCompletionBanner(false)}
          />
        )}
        
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        />
        
        {typingUsers.length > 0 && (
          <GroupTypingIndicator userIds={typingUsers} />
        )}
        
        {renderInputArea()}
        
        <Modal
          visible={showParticipants}
          animationType="slide"
          onRequestClose={() => setShowParticipants(false)}
        >
          <GroupParticipantsList
            groupChatId={groupChatId}
            onClose={() => setShowParticipants(false)}
          />
        </Modal>
        
        <Modal
          visible={showReactionPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowReactionPicker(false)}
        >
          <MessageReactionPicker
            onReaction={handleReaction}
            onClose={() => setShowReactionPicker(false)}
          />
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.body,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.surface,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerCenter: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  groupName: {
    fontSize: typography.fontSize.h3,
    color: colors.text.primary,
  },
  participantCount: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
  },
  headerButton: {
    padding: spacing.xs,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: spacing.sm,
  },
  inputContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  replyText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: typography.fontSize.body,
    color: colors.text.primary,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
});

export default GroupChatScreen;