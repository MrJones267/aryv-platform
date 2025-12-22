/**
 * @fileoverview Chat message component for courier-sender communication
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';

export interface MessageData {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'courier' | 'sender' | 'system';
  message: string;
  messageType: 'text' | 'image' | 'location' | 'system' | 'delivery_update';
  timestamp: string;
  imageUrl?: string;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  deliveryUpdate?: {
    status: string;
    description: string;
  };
  isRead: boolean;
  isDelivered: boolean;
}

interface ChatMessageProps {
  message: MessageData;
  isCurrentUser: boolean;
  showAvatar?: boolean;
  onImagePress?: (imageUrl: string) => void;
  onLocationPress?: (location: MessageData['location']) => void;
  onMessagePress?: (message: MessageData) => void;
  onResend?: (message: MessageData) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isCurrentUser,
  showAvatar = true,
  onImagePress,
  onLocationPress,
  onMessagePress,
  onResend,
}) => {
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMessageStatusIcon = () => {
    if (!isCurrentUser) return null;
    
    if (!message.isDelivered) {
      return <Icon name="schedule" size={12} color={colors.text.secondary} />;
    }
    
    if (message.isRead) {
      return <Icon name="done-all" size={12} color={colors.primary} />;
    }
    
    return <Icon name="done" size={12} color={colors.text.secondary} />;
  };

  const getSenderTypeColor = (senderType: MessageData['senderType']) => {
    switch (senderType) {
      case 'courier': return colors.primary;
      case 'sender': return colors.success;
      case 'system': return colors.warning;
      default: return colors.text.secondary;
    }
  };

  const renderTextMessage = () => (
    <TouchableOpacity
      style={[
        styles.messageContainer,
        isCurrentUser ? styles.sentMessage : styles.receivedMessage,
      ]}
      onPress={() => onMessagePress?.(message)}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.messageText,
        isCurrentUser ? styles.sentMessageText : styles.receivedMessageText,
      ]}>
        {message.message}
      </Text>
    </TouchableOpacity>
  );

  const renderImageMessage = () => (
    <TouchableOpacity
      style={[
        styles.messageContainer,
        isCurrentUser ? styles.sentMessage : styles.receivedMessage,
        styles.imageMessageContainer,
      ]}
      onPress={() => onImagePress?.(message.imageUrl!)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: message.imageUrl }}
        style={styles.messageImage}
        resizeMode="cover"
      />
      {message.message && (
        <Text style={[
          styles.imageCaption,
          isCurrentUser ? styles.sentMessageText : styles.receivedMessageText,
        ]}>
          {message.message}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderLocationMessage = () => (
    <TouchableOpacity
      style={[
        styles.messageContainer,
        isCurrentUser ? styles.sentMessage : styles.receivedMessage,
        styles.locationMessageContainer,
      ]}
      onPress={() => onLocationPress?.(message.location)}
      activeOpacity={0.7}
    >
      <View style={styles.locationHeader}>
        <Icon name="location-on" size={20} color={colors.primary} />
        <Text style={styles.locationTitle}>Location Shared</Text>
      </View>
      <Text style={styles.locationAddress}>
        {message.location?.address || 'Unknown location'}
      </Text>
      <Text style={styles.locationAction}>Tap to view on map</Text>
    </TouchableOpacity>
  );

  const renderSystemMessage = () => (
    <View style={styles.systemMessageContainer}>
      <Text style={styles.systemMessageText}>{message.message}</Text>
    </View>
  );

  const renderDeliveryUpdateMessage = () => (
    <View style={[
      styles.messageContainer,
      styles.deliveryUpdateContainer,
    ]}>
      <View style={styles.deliveryUpdateHeader}>
        <Icon name="local-shipping" size={20} color={colors.primary} />
        <Text style={styles.deliveryUpdateTitle}>Delivery Update</Text>
      </View>
      <Text style={styles.deliveryUpdateStatus}>
        Status: {message.deliveryUpdate?.status}
      </Text>
      <Text style={styles.deliveryUpdateDescription}>
        {message.deliveryUpdate?.description}
      </Text>
    </View>
  );

  const renderMessageContent = () => {
    switch (message.messageType) {
      case 'text':
        return renderTextMessage();
      case 'image':
        return renderImageMessage();
      case 'location':
        return renderLocationMessage();
      case 'system':
        return renderSystemMessage();
      case 'delivery_update':
        return renderDeliveryUpdateMessage();
      default:
        return renderTextMessage();
    }
  };

  const renderAvatar = () => {
    if (!showAvatar || isCurrentUser || message.messageType === 'system') {
      return <View style={styles.avatarPlaceholder} />;
    }

    return (
      <View style={[
        styles.avatar,
        { backgroundColor: getSenderTypeColor(message.senderType) + '20' }
      ]}>
        <Text style={[
          styles.avatarText,
          { color: getSenderTypeColor(message.senderType) }
        ]}>
          {message.senderName.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  };

  if (message.messageType === 'system') {
    return (
      <View style={styles.systemMessageWrapper}>
        {renderMessageContent()}
        <Text style={styles.systemTimestamp}>{formatTime(message.timestamp)}</Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.messageWrapper,
      isCurrentUser ? styles.sentMessageWrapper : styles.receivedMessageWrapper,
    ]}>
      {!isCurrentUser && renderAvatar()}
      
      <View style={styles.messageContentWrapper}>
        {!isCurrentUser && (
          <Text style={[
            styles.senderName,
            { color: getSenderTypeColor(message.senderType) }
          ]}>
            {message.senderName}
          </Text>
        )}
        
        {renderMessageContent()}
        
        <View style={[
          styles.messageFooter,
          isCurrentUser ? styles.sentMessageFooter : styles.receivedMessageFooter,
        ]}>
          <Text style={styles.messageTime}>{formatTime(message.timestamp)}</Text>
          {getMessageStatusIcon()}
          {!message.isDelivered && isCurrentUser && (
            <TouchableOpacity
              style={styles.resendButton}
              onPress={() => onResend?.(message)}
            >
              <Icon name="refresh" size={12} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {isCurrentUser && <View style={styles.avatarPlaceholder} />}
    </View>
  );
};

const styles = StyleSheet.create({
  messageWrapper: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  sentMessageWrapper: {
    justifyContent: 'flex-end',
  },
  receivedMessageWrapper: {
    justifyContent: 'flex-start',
  },
  messageContentWrapper: {
    flex: 1,
    maxWidth: '80%',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  avatarPlaceholder: {
    width: 32,
    marginLeft: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageContainer: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginVertical: 2,
  },
  sentMessage: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  receivedMessage: {
    backgroundColor: colors.background.secondary,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  sentMessageText: {
    color: colors.text.inverse,
  },
  receivedMessageText: {
    color: colors.text.primary,
  },
  imageMessageContainer: {
    padding: 4,
    maxWidth: 200,
  },
  messageImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
  },
  imageCaption: {
    marginTop: 8,
    fontSize: 14,
    paddingHorizontal: 8,
  },
  locationMessageContainer: {
    padding: 12,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    color: colors.text.primary,
  },
  locationAddress: {
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 4,
  },
  locationAction: {
    fontSize: 12,
    color: colors.primary,
    fontStyle: 'italic',
  },
  systemMessageWrapper: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 32,
  },
  systemMessageText: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  systemTimestamp: {
    fontSize: 10,
    color: colors.text.secondary,
    marginTop: 4,
  },
  deliveryUpdateContainer: {
    backgroundColor: colors.primary + '20',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: 12,
  },
  deliveryUpdateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  deliveryUpdateTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    color: colors.primary,
  },
  deliveryUpdateStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  deliveryUpdateDescription: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 18,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  sentMessageFooter: {
    justifyContent: 'flex-end',
  },
  receivedMessageFooter: {
    justifyContent: 'flex-start',
  },
  messageTime: {
    fontSize: 11,
    color: colors.text.secondary,
    marginRight: 4,
  },
  resendButton: {
    marginLeft: 4,
    padding: 2,
  },
});

export default ChatMessage;