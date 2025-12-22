/**
 * @fileoverview Chat screen for driver-passenger communication
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppSelector } from '../../store/hooks';
import { ChatScreenProps } from '../../navigation/types';
import { CallIntegrationService } from '../../services/CallIntegrationService';

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
  // Additional params that might be passed from ride context
  const rideId = (route.params as any)?.rideId;
  const bookingId = (route.params as any)?.bookingId;
  const { profile: user } = useAppSelector((state) => state.user);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: recipientName,
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleVideoCall}>
            <Icon name="videocam" size={24} color="#4CAF50" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleVoiceCall}>
            <Icon name="call" size={24} color="#2196F3" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleMoreOptions}>
            <Icon name="more-vert" size={24} color="#666666" />
          </TouchableOpacity>
        </View>
      ),
    });

    loadMessages();
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      simulateIncomingMessage();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadMessages = (): void => {
    // Mock chat data - replace with actual API call
    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        senderId: 'other-user-id',
        senderName: recipientName,
        message: 'Hi! I\'m interested in your ride to downtown.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        type: 'text',
        isRead: true,
      },
      {
        id: '2',
        senderId: user?.id || 'current-user',
        senderName: user?.firstName || 'You',
        message: 'Great! I have 2 seats available. When do you need to leave?',
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

    setMessages(mockMessages);
  };

  const simulateIncomingMessage = (): void => {
    const randomMessages = [
      'I\'m running a few minutes late, is that okay?',
      'Just arrived at the pickup location',
      'Thank you for the smooth ride!',
      'Could you please share your location?',
    ];

    if (Math.random() > 0.7) { // 30% chance
      const newMsg: ChatMessage = {
        id: Date.now().toString(),
        senderId: 'other-user-id',
        senderName: recipientName,
        message: randomMessages[Math.floor(Math.random() * randomMessages.length)],
        timestamp: new Date().toISOString(),
        type: 'text',
        isRead: false,
      };

      setMessages(prev => [...prev, newMsg]);
      scrollToBottom();
    }
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

    setMessages(prev => [...prev, message]);
    setNewMessage('');
    scrollToBottom();
  };

  const handleVoiceCall = async (): Promise<void> => {
    try {
      const callIntegration = CallIntegrationService.getInstance();
      
      // Check if already in a call
      if (callIntegration.isInCall()) {
        Alert.alert(
          'Call in Progress',
          'You are already in an active call. Please end the current call first.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Get the participant ID from route params
      const participantId = chatId;
      
      // Initiate voice call
      const success = await callIntegration.initiateCall(participantId, 'voice', {
        participantId,
        participantName: 'Chat Participant',
        participantRole: 'driver', // Assume this is driver chat
        rideId: rideId,
      });
      
      if (!success) {
        Alert.alert(
          'Call Failed',
          'Unable to initiate call. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error initiating voice call:', error);
      Alert.alert(
        'Call Error',
        'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleVideoCall = async (): Promise<void> => {
    try {
      const callIntegration = CallIntegrationService.getInstance();
      
      // Check if already in a call
      if (callIntegration.isInCall()) {
        Alert.alert(
          'Call in Progress',
          'You are already in an active call. Please end the current call first.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Get the participant ID from route params
      const participantId = chatId;
      
      // Initiate video call
      const success = await callIntegration.initiateCall(participantId, 'video', {
        participantId,
        participantName: 'Chat Participant',
        participantRole: 'driver', // Assume this is driver chat
        rideId: rideId,
      });
      
      if (!success) {
        Alert.alert(
          'Video Call Failed',
          'Unable to initiate video call. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error initiating video call:', error);
      Alert.alert(
        'Video Call Error',
        'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleMoreOptions = (): void => {
    Alert.alert(
      'Options',
      'Choose an action',
      [
        { text: 'Share Location', onPress: handleShareLocation },
        { text: 'Report User', onPress: handleReportUser, style: 'destructive' },
        { text: 'Block User', onPress: handleBlockUser, style: 'destructive' },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleShareLocation = (): void => {
    // Share current location
    console.log('Sharing location...');
    Alert.alert('Location Shared', 'Your current location has been shared.');
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
      ]
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
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return date.toLocaleDateString();
    return date.toLocaleDateString();
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }): React.JSX.Element => {
    const isCurrentUser = item.senderId === user?.id || item.senderId === 'current-user';
    const isSystem = item.type === 'system';
    const showTimestamp = index === 0 || 
      (messages[index - 1] && 
       new Date(item.timestamp).getTime() - new Date(messages[index - 1].timestamp).getTime() > 300000); // 5 minutes

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
        
        <View style={[
          styles.messageBubble,
          isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
        ]}>
          {!isCurrentUser && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}
          <Text style={[
            styles.messageText,
            isCurrentUser ? styles.currentUserText : styles.otherUserText,
          ]}>
            {item.message}
          </Text>
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
                color={item.isRead ? '#2196F3' : '#CCCCCC'}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderInputBar = (): React.JSX.Element => (
    <View style={styles.inputContainer}>
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.attachButton}>
          <Icon name="attach-file" size={24} color="#666666" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor="#999999"
          value={newMessage}
          onChangeText={setNewMessage}
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
        {/* Online Status */}
        {isOnline && (
          <View style={styles.onlineStatus}>
            <View style={styles.onlineIndicator} />
            <Text style={styles.onlineText}>{recipientName} is online</Text>
          </View>
        )}

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
        />

        {/* Typing Indicator */}
        {isTyping && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>{recipientName} is typing...</Text>
          </View>
        )}

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
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#F0F8FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 6,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  onlineText: {
    fontSize: 12,
    color: '#4CAF50',
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  typingText: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
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