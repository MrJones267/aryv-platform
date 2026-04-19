/**
 * @fileoverview Notifications inbox screen - shows user's notification history
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { StackNavigationProp } from '@react-navigation/stack';
import notificationsApi, { NotificationRecord } from '../../services/api/notificationsApi';
import { useSocketEvent } from '../../hooks/useSocket';
import { colors } from '../../theme';

type NotificationsScreenProps = {
  navigation: StackNavigationProp<any>;
};

const NOTIFICATION_ICONS: Record<string, string> = {
  new_booking_request: 'directions-car',
  booking_status_change: 'check-circle',
  ride_status_change: 'local-taxi',
  payment: 'payment',
  system: 'info',
};

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  // Prepend new real-time notifications as they arrive
  useSocketEvent('notification', (data: Record<string, unknown>) => {
    const incoming: NotificationRecord = {
      id: String(data['id'] || Date.now()),
      type: String(data['type'] || 'system'),
      title: String(data['title'] || ''),
      message: String(data['message'] || ''),
      data: (data['data'] as Record<string, unknown>) || undefined,
      readAt: null,
      createdAt: String(data['timestamp'] || new Date().toISOString()),
    };
    setNotifications((prev) => [incoming, ...prev]);
    setUnreadCount((prev) => prev + 1);
  });

  const loadNotifications = useCallback(async (pageNum = 1, append = false) => {
    try {
      const response = await notificationsApi.getNotifications({ page: pageNum, limit: 20 });
      if (response.success && response.data) {
        const { notifications: items, pagination } = response.data;
        setNotifications((prev) => (append ? [...prev, ...items] : items));
        setTotalPages(pagination.totalPages);
        setUnreadCount(pagination.unreadCount);
        setPage(pageNum);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load notifications.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadNotifications(1);
      setIsLoading(false);
    })();
  }, [loadNotifications]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications(1);
    setIsRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || page >= totalPages) return;
    setIsLoadingMore(true);
    await loadNotifications(page + 1, true);
    setIsLoadingMore(false);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      Alert.alert('Error', 'Failed to mark notifications as read.');
    }
  };

  const handleNotificationPress = async (item: NotificationRecord) => {
    if (!item.readAt) {
      await notificationsApi.markAsRead([item.id]).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const renderItem = ({ item }: { item: NotificationRecord }) => {
    const isUnread = !item.readAt;
    const iconName = NOTIFICATION_ICONS[item.type] || 'notifications';
    return (
      <TouchableOpacity
        style={[styles.item, isUnread && styles.itemUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, isUnread && styles.iconContainerUnread]}>
          <Icon name={iconName} size={22} color={isUnread ? colors.primary : colors.text.secondary} />
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.itemMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.itemTime}>{formatTime(item.createdAt)}</Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {unreadCount > 0 && (
        <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
          <Text style={styles.markAllText}>Mark all as read ({unreadCount})</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="notifications-none" size={64} color={colors.text.secondary} />
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptySubtitle}>You'll see ride updates, booking confirmations, and more here.</Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={isLoadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : undefined}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  markAllButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    marginBottom: 4,
  },
  markAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  itemUnread: {
    backgroundColor: colors.primary + '08',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconContainerUnread: {
    backgroundColor: colors.primary + '20',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 3,
  },
  itemTitleUnread: {
    fontWeight: '700',
  },
  itemMessage: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  itemTime: {
    fontSize: 11,
    color: colors.text.light,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginLeft: 8,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  footerLoader: {
    paddingVertical: 16,
  },
});

export default NotificationsScreen;
