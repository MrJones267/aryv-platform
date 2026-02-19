/**
 * @fileoverview Chat list component showing conversation history
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import ChatMessage, { MessageData } from './ChatMessage';

interface ChatListProps {
  messages: MessageData[];
  currentUserId: string;
  userType: 'courier' | 'sender';
  onRefresh?: () => Promise<void>;
  onImagePress?: (imageUrl: string) => void;
  onLocationPress?: (location: MessageData['location']) => void;
  onMessagePress?: (message: MessageData) => void;
  onResendMessage?: (message: MessageData) => void;
  isLoading?: boolean;
  hasMoreMessages?: boolean;
  onLoadMore?: () => void;
  onScrollToTop?: () => void;
}

const ChatList: React.FC<ChatListProps> = ({
  messages,
  currentUserId,
  userType,
  onRefresh,
  onImagePress,
  onLocationPress,
  onMessagePress,
  onResendMessage,
  isLoading = false,
  hasMoreMessages = false,
  onLoadMore,
  onScrollToTop,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
  };

  const handleLoadMore = () => {
    if (hasMoreMessages && !isLoading && onLoadMore) {
      onLoadMore();
    }
  };

  const renderMessage = ({ item, index }: { item: MessageData; index: number }) => {
    const isCurrentUser = item.senderId === currentUserId;
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showAvatar = !previousMessage || 
                      previousMessage.senderId !== item.senderId ||
                      previousMessage.messageType === 'system';

    return (
      <ChatMessage
        key={item.id}
        message={item}
        isCurrentUser={isCurrentUser}
        showAvatar={showAvatar}
        onImagePress={onImagePress}
        onLocationPress={onLocationPress}
        onMessagePress={onMessagePress}
        onResend={onResendMessage}
      />
    );
  };

  const renderDateSeparator = (date: string) => (
    <View style={styles.dateSeparator}>
      <View style={styles.dateLine} />
      <Text style={styles.dateText}>{date}</Text>
      <View style={styles.dateLine} />
    </View>
  );

  const renderLoadMoreHeader = () => {
    if (!hasMoreMessages) return null;

    return (
      <View style={styles.loadMoreContainer}>
        {isLoading ? (
          <Text style={styles.loadMoreText}>Loading more messages...</Text>
        ) : (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={handleLoadMore}
          >
            <Icon name="keyboard-arrow-up" size={20} color={colors.primary} />
            <Text style={styles.loadMoreButtonText}>Load more messages</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="chat-bubble-outline" size={64} color={colors.text.secondary} />
      <Text style={styles.emptyTitle}>Start a conversation</Text>
      <Text style={styles.emptySubtitle}>
        {userType === 'courier' 
          ? 'Send a message to update the sender about the delivery'
          : 'Send a message to communicate with your courier'
        }
      </Text>
    </View>
  );

  const renderScrollToBottom = () => {
    const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);

    const handleScroll = (event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const isNearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
      setShowScrollToBottom(!isNearBottom && messages.length > 10);
    };

    const scrollToBottom = () => {
      flatListRef.current?.scrollToEnd({ animated: true });
      setShowScrollToBottom(false);
    };

    if (!showScrollToBottom) return null;

    return (
      <TouchableOpacity
        style={styles.scrollToBottomButton}
        onPress={scrollToBottom}
      >
        <Icon name="keyboard-arrow-down" size={24} color={colors.text.inverse} />
      </TouchableOpacity>
    );
  };

  const addDateSeparators = (messages: MessageData[]) => {
    const messagesWithDates: (MessageData | { type: 'date'; date: string })[] = [];
    let lastDate = '';

    messages.forEach((message) => {
      const messageDate = new Date(message.timestamp).toDateString();
      
      if (messageDate !== lastDate) {
        messagesWithDates.push({
          type: 'date',
          date: formatDateSeparator(new Date(message.timestamp)),
        });
        lastDate = messageDate;
      }
      
      messagesWithDates.push(message);
    });

    return messagesWithDates;
  };

  const formatDateSeparator = (date: Date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const messagesWithDates = addDateSeparators(messages);

  const renderItem = ({ item, index }: { item: MessageData | { type: 'date'; date: string }; index: number }) => {
    if ('date' in item && item.type === 'date') {
      return renderDateSeparator(item.date);
    }
    return renderMessage({ item: item as MessageData, index });
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messagesWithDates}
        renderItem={renderItem}
        keyExtractor={(item, index) =>
          'date' in item && item.type === 'date' ? `date-${index}` : (item as MessageData).id
        }
        ListHeaderComponent={renderLoadMoreHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          ) : undefined
        }
        onScroll={onScrollToTop}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        inverted={false}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
      />
      
      {renderScrollToBottom()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  listContent: {
    flexGrow: 1,
    paddingVertical: 8,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    marginHorizontal: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  dateText: {
    fontSize: 12,
    color: colors.text.secondary,
    paddingHorizontal: 12,
    backgroundColor: colors.background.primary,
  },
  loadMoreContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadMoreText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  loadMoreButtonText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: '500',
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
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.text.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default ChatList;