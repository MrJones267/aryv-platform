/**
 * @fileoverview Chat screen for courier-sender communication
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import logger from '../../services/LoggingService';
import chatApi from '../../services/api/chatApi';
import { useAppSelector } from '../../store/hooks';

const log = logger.createLogger('ChatScreen');
import {
  ChatList,
  ChatInput,
  MessageData,
} from '../../components/communication';
import { useI18n } from '../../i18n/I18nContext';

interface ChatScreenParams {
  packageId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserType: 'courier' | 'sender';
  deliveryStatus?: string;
}

const ChatScreen: React.FC = () => {
  const { t } = useI18n();
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as ChatScreenParams;

  const [messages, setMessages] = useState<MessageData[]>([]);
  const currentUser = useAppSelector((state) => state.user.profile);
  const currentUserId = currentUser?.id || '';
  const [userType] = useState<'courier' | 'sender'>('sender');
  const [isTyping, setIsTyping] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<'online' | 'offline' | 'last_seen'>('online');
  const [lastSeen, setLastSeen] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [deliveryActive, setDeliveryActive] = useState(false);

  useEffect(() => {
    // Load existing messages for this package/conversation
    loadMessages();
    
    // Set up real-time messaging listeners
    setupRealtimeListeners();
    
    // Check delivery status
    checkDeliveryStatus();

    return () => {
      // Cleanup listeners
      cleanupListeners();
    };
  }, [params.packageId]);

  const loadMessages = async () => {
    try {
      // Use packageId as the group chat id for courier conversations
      const response = await chatApi.getGroupMessages(params.packageId, { limit: 50 });
      if (response.success && response.data?.messages) {
        const history: MessageData[] = response.data.messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          senderName: m.senderName,
          senderType: (m.senderId === 'system' ? 'system' : m.senderId === currentUserId ? userType : params.otherUserType) as MessageData['senderType'],
          message: m.content,
          messageType: (m.type === 'image' ? 'text' : m.type) as MessageData['messageType'],
          timestamp: m.timestamp,
          isRead: m.isRead,
          isDelivered: true,
          location: m.location ? {
            latitude: m.location.latitude,
            longitude: m.location.longitude,
            address: m.location.address || '',
          } : undefined,
        }));
        setMessages(history);
      }
    } catch (error) {
      log.error('Error loading messages:', error);
      Alert.alert(t('common.error'), t('ui.failedToLoadConversationHistory'));
    }
  };

  const setupRealtimeListeners = () => {
    // Real-time updates handled via socket in parent navigator
  };

  const cleanupListeners = () => {
    // Cleanup real-time listeners
  };

  const checkDeliveryStatus = () => {
    // Check if delivery is currently active
    setDeliveryActive(params.deliveryStatus === 'in_progress' || params.deliveryStatus === 'picked_up');
  };

  const handleSendMessage = async (message: string, type: 'text' | 'image' | 'location') => {
    try {
      const newMessage: MessageData = {
        id: `msg_${Date.now()}`,
        senderId: currentUserId,
        senderName: userType === 'courier' ? t('ui.youCourier') : t('ui.you'),
        senderType: userType,
        message,
        messageType: type,
        timestamp: new Date().toISOString(),
        isRead: false,
        isDelivered: false,
      };

      // Optimistically update UI
      setMessages(prev => [...prev, newMessage]);

      // Send to backend
      // await sendMessageToAPI(newMessage);

      // Mock successful delivery
      setTimeout(() => {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === newMessage.id 
              ? { ...msg, isDelivered: true }
              : msg
          )
        );
      }, 1000);

    } catch (error) {
      log.error('Error sending message:', error);
      Alert.alert(t('common.error'), t('ui.failedToSendMessage'));
    }
  };

  const handleSendImage = () => {
    Alert.alert(
      t('ui.sendImage'),
      t('ui.chooseAnOption'),
      [
        { text: t('rf.camera'), onPress: () => openCamera() },
        { text: t('rf.gallery'), onPress: () => openGallery() },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const openCamera = () => {
    // Implement camera functionality
    log.info('Opening camera...');
  };

  const openGallery = () => {
    // Implement gallery functionality
    log.info('Opening gallery...');
  };

  const handleSendLocation = () => {
    Alert.alert(
      t('ui.shareLocation'),
      t('ui.thisWillShareYourCurrent'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.share'), onPress: () => shareCurrentLocation() },
      ]
    );
  };

  const shareCurrentLocation = () => {
    // Get current location and send
    const locationMessage = t('ui.sharedCurrentLocation');
    handleSendMessage(locationMessage, 'location');
  };

  const handleImagePress = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };

  const handleLocationPress = (location: MessageData['location']) => {
    if (location) {
      Alert.alert(
        t('ui.location'),
        location.address,
        [
          { text: t('common.close'), style: 'cancel' },
          { text: t('ui.openInMaps'), onPress: () => openInMaps(location) },
        ]
      );
    }
  };

  const openInMaps = (location: MessageData['location']) => {
    // Open location in maps app
    log.info('Opening location in maps:', location);
  };

  const handleResendMessage = (message: MessageData) => {
    Alert.alert(
      t('ui.resendMessage'),
      t('ui.doYouWantToResend'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('ui.resend'), onPress: () => resendMessage(message) },
      ]
    );
  };

  const resendMessage = (message: MessageData) => {
    // Implement message resend logic
    handleSendMessage(message.message, message.messageType as 'text' | 'location' | 'image');
  };

  const handleCallPress = () => {
    Alert.alert(
      t('ui.callUser'),
      t('ui.callName', { name: params.otherUserName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('cf.call'), onPress: () => initiateCall() },
      ]
    );
  };

  const initiateCall = () => {
    // Implement calling functionality
    log.info('Initiating call...');
  };

  const getStatusIndicator = () => {
    switch (onlineStatus) {
      case 'online':
        return <View style={[styles.statusDot, styles.onlineStatus]} />;
      case 'offline':
        return <View style={[styles.statusDot, styles.offlineStatus]} />;
      default:
        return null;
    }
  };

  const getLastSeenText = () => {
    if (onlineStatus === 'online') {return t('ui.online');}
    if (onlineStatus === 'offline' && lastSeen) {
      return t('ui.lastSeen', { time: new Date(lastSeen).toLocaleTimeString() });
    }
    return t('ui.offline');
  };

  const renderImageModal = () => (
    <Modal
      visible={!!selectedImage}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedImage(null)}
    >
      <View style={styles.imageModalContainer}>
        <TouchableOpacity
          style={styles.imageModalOverlay}
          onPress={() => setSelectedImage(null)}
        >
          <Image
            source={{ uri: selectedImage || '' }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.closeImageButton}
            onPress={() => setSelectedImage(null)}
          >
            <Icon name="close" size={24} color={colors.text.inverse} />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  const renderTypingIndicator = () => {
    if (!isTyping) return null;

    return (
      <View style={styles.typingContainer}>
        <Text style={styles.typingText}>
          {params.otherUserName} is typing...
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.secondary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{params.otherUserName}</Text>
            {getStatusIndicator()}
          </View>
          <Text style={styles.userStatus}>
            {params.otherUserType.charAt(0).toUpperCase() + params.otherUserType.slice(1)} • {getLastSeenText()}
          </Text>
        </View>

        <TouchableOpacity onPress={handleCallPress}>
          <Icon name="phone" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Delivery Status Banner */}
      {deliveryActive && (
        <View style={styles.deliveryBanner}>
          <Icon name="local-shipping" size={16} color={colors.primary} />
          <Text style={styles.deliveryBannerText}>
            Delivery in progress - Package #{params.packageId.slice(-6)}
          </Text>
        </View>
      )}

      {/* Messages */}
      <ChatList
        messages={messages}
        currentUserId={currentUserId}
        userType={userType}
        onImagePress={handleImagePress}
        onLocationPress={handleLocationPress}
        onResendMessage={handleResendMessage}
      />

      {/* Typing Indicator */}
      {renderTypingIndicator()}

      {/* Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onSendImage={handleSendImage}
        onSendLocation={handleSendLocation}
        userType={userType}
        isDeliveryActive={deliveryActive}
        placeholder={t('ui.messageName', { name: params.otherUserName })}
      />

      {/* Image Modal */}
      {renderImageModal()}
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginRight: 8,
  },
  userStatus: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineStatus: {
    backgroundColor: colors.success,
  },
  offlineStatus: {
    backgroundColor: colors.text.secondary,
  },
  deliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  deliveryBannerText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 8,
    fontWeight: '500',
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background.secondary,
  },
  typingText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  imageModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '90%',
    height: '70%',
  },
  closeImageButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatScreen;