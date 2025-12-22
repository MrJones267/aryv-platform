/**
 * @fileoverview Chat input component for sending messages
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';

export interface QuickReply {
  id: string;
  text: string;
  icon?: string;
  category: 'courier' | 'sender' | 'general';
}

interface ChatInputProps {
  onSendMessage: (message: string, type: 'text' | 'image' | 'location') => void;
  onSendImage?: () => void;
  onSendLocation?: () => void;
  userType: 'courier' | 'sender';
  isDeliveryActive?: boolean;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onSendImage,
  onSendLocation,
  userType,
  isDeliveryActive = false,
  placeholder = 'Type a message...',
  disabled = false,
  maxLength = 1000,
}) => {
  const [message, setMessage] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const quickRepliesAnimation = useRef(new Animated.Value(0)).current;

  const courierQuickReplies: QuickReply[] = [
    { id: 'pickup_arrived', text: "I've arrived for pickup", icon: 'location-on', category: 'courier' },
    { id: 'on_way', text: 'On my way to delivery location', icon: 'directions', category: 'courier' },
    { id: 'delivered', text: 'Package delivered successfully', icon: 'check-circle', category: 'courier' },
    { id: 'delay', text: 'Running a bit late, will update soon', icon: 'schedule', category: 'courier' },
    { id: 'contact_recipient', text: 'Trying to contact the recipient', icon: 'phone', category: 'courier' },
    { id: 'issue', text: 'Encountered an issue with delivery', icon: 'warning', category: 'courier' },
  ];

  const senderQuickReplies: QuickReply[] = [
    { id: 'thanks', text: 'Thank you!', icon: 'thumb-up', category: 'sender' },
    { id: 'ready', text: 'Package is ready for pickup', icon: 'check', category: 'sender' },
    { id: 'location_shared', text: 'Shared my location', icon: 'location-on', category: 'sender' },
    { id: 'instructions', text: 'Please check delivery instructions', icon: 'info', category: 'sender' },
    { id: 'urgent', text: 'This is urgent delivery', icon: 'priority-high', category: 'sender' },
    { id: 'fragile', text: 'Handle with care - fragile items', icon: 'warning', category: 'sender' },
  ];

  const getQuickReplies = () => {
    return userType === 'courier' ? courierQuickReplies : senderQuickReplies;
  };

  const handleSendMessage = () => {
    if (message.trim().length === 0) return;
    
    onSendMessage(message.trim(), 'text');
    setMessage('');
    inputRef.current?.blur();
  };

  const handleQuickReply = (quickReply: QuickReply) => {
    onSendMessage(quickReply.text, 'text');
    setShowQuickReplies(false);
    toggleQuickReplies();
  };

  const toggleQuickReplies = () => {
    const toValue = showQuickReplies ? 0 : 1;
    setShowQuickReplies(!showQuickReplies);
    
    Animated.spring(quickRepliesAnimation, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const handleAttachmentPress = (type: 'image' | 'location') => {
    setShowAttachments(false);
    
    switch (type) {
      case 'image':
        onSendImage?.();
        break;
      case 'location':
        onSendLocation?.();
        break;
    }
  };

  const renderQuickReplies = () => (
    <Animated.View
      style={[
        styles.quickRepliesContainer,
        {
          transform: [{
            translateY: quickRepliesAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [100, 0],
            }),
          }],
          opacity: quickRepliesAnimation,
        },
      ]}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {getQuickReplies().map((reply) => (
          <TouchableOpacity
            key={reply.id}
            style={styles.quickReplyButton}
            onPress={() => handleQuickReply(reply)}
          >
            {reply.icon && (
              <Icon name={reply.icon} size={16} color={colors.primary} />
            )}
            <Text style={styles.quickReplyText}>{reply.text}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );

  const renderAttachmentModal = () => (
    <Modal
      visible={showAttachments}
      transparent
      animationType="fade"
      onRequestClose={() => setShowAttachments(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowAttachments(false)}
      >
        <View style={styles.attachmentMenu}>
          <TouchableOpacity
            style={styles.attachmentOption}
            onPress={() => handleAttachmentPress('image')}
          >
            <View style={styles.attachmentIconContainer}>
              <Icon name="photo-camera" size={24} color={colors.primary} />
            </View>
            <Text style={styles.attachmentText}>Camera</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.attachmentOption}
            onPress={() => handleAttachmentPress('image')}
          >
            <View style={styles.attachmentIconContainer}>
              <Icon name="photo-library" size={24} color={colors.success} />
            </View>
            <Text style={styles.attachmentText}>Gallery</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.attachmentOption}
            onPress={() => handleAttachmentPress('location')}
          >
            <View style={styles.attachmentIconContainer}>
              <Icon name="location-on" size={24} color={colors.warning} />
            </View>
            <Text style={styles.attachmentText}>Location</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {showQuickReplies && renderQuickReplies()}
      
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.quickReplyToggle}
          onPress={toggleQuickReplies}
        >
          <Icon 
            name={showQuickReplies ? "keyboard-arrow-down" : "keyboard-arrow-up"} 
            size={24} 
            color={colors.text.secondary} 
          />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={message}
          onChangeText={setMessage}
          placeholder={placeholder}
          placeholderTextColor={colors.text.secondary}
          multiline
          maxLength={maxLength}
          editable={!disabled}
          blurOnSubmit={false}
          onSubmitEditing={handleSendMessage}
        />

        <View style={styles.inputActions}>
          <TouchableOpacity
            style={styles.attachmentButton}
            onPress={() => setShowAttachments(true)}
            disabled={disabled}
          >
            <Icon name="attach-file" size={20} color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendButton,
              { opacity: message.trim().length > 0 ? 1 : 0.5 }
            ]}
            onPress={handleSendMessage}
            disabled={disabled || message.trim().length === 0}
          >
            <Icon name="send" size={20} color={colors.text.inverse} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusIndicator}>
        {isDeliveryActive && (
          <View style={styles.deliveryStatus}>
            <View style={styles.pulseIndicator} />
            <Text style={styles.deliveryStatusText}>Delivery in progress</Text>
          </View>
        )}
        
        {message.length > maxLength * 0.9 && (
          <Text style={styles.characterCount}>
            {message.length}/{maxLength}
          </Text>
        )}
      </View>

      {renderAttachmentModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  quickRepliesContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  quickReplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    marginLeft: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  quickReplyText: {
    fontSize: 12,
    color: colors.text.primary,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 56,
  },
  quickReplyToggle: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text.primary,
    maxHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  attachmentButton: {
    padding: 8,
    marginRight: 4,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    minHeight: 20,
  },
  deliveryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  deliveryStatusText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
  },
  characterCount: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  attachmentMenu: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  attachmentOption: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  attachmentIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  attachmentText: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: '500',
  },
});

export default ChatInput;