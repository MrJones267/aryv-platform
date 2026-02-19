/**
 * @fileoverview Group Chat List Screen for managing group conversations
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  StyleSheet,
  SafeAreaView,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { GroupChatService } from '../services/GroupChatService';
import SocketService from '../services/SocketService';
// import { useAuth } from '../contexts/AuthContext';
const useAuth = () => ({ user: { id: 'mock-user', firstName: 'Mock', lastName: 'User' } });
import { colors, spacing, typography } from '../theme';
import { GroupChatListItem } from '../components/GroupChatListItem';
import { CreateGroupModal } from '../components/CreateGroupModal';
import logger from '../services/LoggingService';

const log = logger.createLogger('GroupChatListScreen');

interface GroupChat {
  id: string;
  name: string;
  description?: string;
  type: string;
  participantCount: number;
  unreadCount: number;
  lastMessage?: {
    content: string;
    senderId: string;
    senderName: string;
    createdAt: string;
    type: string;
  };
  isOnline?: boolean;
  avatarUrl?: string;
}

export const GroupChatListScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');

  const socketService = SocketService.getInstance();

  useEffect(() => {
    loadGroupChats();
    setupSocketListeners();

    return () => {
      cleanupSocketListeners();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGroupChats();
    }, [])
  );

  const loadGroupChats = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const options = {
        search: searchQuery,
        type: selectedType === 'all' ? undefined : selectedType,
        limit: 50,
        offset: 0,
      };

      const response = await GroupChatService.getUserGroupChats(options);
      
      if (response.success) {
        setGroupChats((response.data as unknown as { groupChats: GroupChat[] })?.groupChats || []);
      }
    } catch (error) {
      log.error('Error loading group chats:', error);
      Alert.alert('Error', 'Failed to load group chats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setupSocketListeners = () => {
    socketService.on('group_message', handleNewMessage);
    socketService.on('group_created', handleGroupCreated);
    socketService.on('participant_joined', handleParticipantJoined);
    socketService.on('participant_left', handleParticipantLeft);
  };

  const cleanupSocketListeners = () => {
    socketService.off('group_message', handleNewMessage);
    socketService.off('group_created', handleGroupCreated);
    socketService.off('participant_joined', handleParticipantJoined);
    socketService.off('participant_left', handleParticipantLeft);
  };

  const handleNewMessage = (data: { message: Record<string, unknown>; groupChatId: string }) => {
    setGroupChats(prev =>
      prev.map(group => {
        if (group.id === data.groupChatId) {
          return {
            ...group,
            lastMessage: {
              content: data.message.content as string,
              senderId: data.message.senderId as string,
              senderName: (data.message.sender as Record<string, unknown>)?.firstName as string || 'Unknown',
              createdAt: data.message.createdAt as string,
              type: data.message.type as string,
            },
            unreadCount: data.message.senderId !== user?.id 
              ? group.unreadCount + 1 
              : group.unreadCount,
          };
        }
        return group;
      })
    );
  };

  const handleGroupCreated = (data: { groupChat: GroupChat }) => {
    setGroupChats(prev => [data.groupChat, ...prev]);
  };

  const handleParticipantJoined = (data: { groupChatId: string }) => {
    setGroupChats(prev => 
      prev.map(group => 
        group.id === data.groupChatId 
          ? { ...group, participantCount: group.participantCount + 1 }
          : group
      )
    );
  };

  const handleParticipantLeft = (data: { groupChatId: string }) => {
    setGroupChats(prev => 
      prev.map(group => 
        group.id === data.groupChatId 
          ? { ...group, participantCount: Math.max(0, group.participantCount - 1) }
          : group
      )
    );
  };

  const handleGroupPress = (groupChat: GroupChat) => {
    (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('GroupChat', {
      groupChatId: groupChat.id,
      groupName: groupChat.name,
    });
  };

  const handleCreateGroup = async (groupData: Record<string, unknown>) => {
    try {
      const response = await GroupChatService.createGroupChat(groupData as unknown as import('../services/GroupChatService').CreateGroupChatRequest);
      
      if (response.success) {
        setShowCreateModal(false);
        loadGroupChats();
        Alert.alert('Success', 'Group chat created successfully');
      }
    } catch (error) {
      log.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group chat');
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Debounce search
    setTimeout(() => {
      loadGroupChats();
    }, 500);
  };

  const handleTypeFilter = (type: string) => {
    setSelectedType(type);
    loadGroupChats();
  };

  const onRefresh = () => {
    loadGroupChats(true);
  };

  const renderGroupChat = ({ item }: { item: GroupChat }) => (
    <GroupChatListItem
      groupChat={item}
      onPress={() => handleGroupPress(item)}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>Group Chats</Text>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Icon name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={colors.text.secondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search groups..."
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor={colors.text.secondary}
        />
      </View>

      <View style={styles.filterContainer}>
        {[
          { key: 'all', label: 'All' },
          { key: 'ride_group', label: 'Rides' },
          { key: 'delivery_group', label: 'Delivery' },
          { key: 'custom_group', label: 'Custom' },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterButton,
              selectedType === filter.key && styles.filterButtonActive,
            ]}
            onPress={() => handleTypeFilter(filter.key)}
          >
            <Text
              style={[
                styles.filterText,
                selectedType === filter.key && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcon name="group" size={64} color={colors.text.secondary} />
      <Text style={styles.emptyTitle}>No Group Chats</Text>
      <Text style={styles.emptyText}>
        Create or join group chats to start messaging with multiple people
      </Text>
      <TouchableOpacity 
        style={styles.createGroupButton}
        onPress={() => setShowCreateModal(true)}
      >
        <Text style={styles.createGroupText}>Create Group</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      <FlatList
        data={groupChats}
        renderItem={renderGroupChat}
        keyExtractor={(item) => item.id}
        style={styles.groupsList}
        contentContainerStyle={groupChats.length === 0 ? styles.emptyContent : undefined}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={!loading ? renderEmptyState : null}
      />

      <CreateGroupModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateGroup={handleCreateGroup}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.surface,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.title,
    color: colors.text.primary,
  },
  createButton: {
    padding: spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.body,
    color: colors.text.primary,
    marginLeft: spacing.xs,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  filterButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: typography.fontSize.caption,
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: colors.white,
    fontWeight: 'bold',
  },
  groupsList: {
    flex: 1,
  },
  emptyContent: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  createGroupButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  createGroupText: {
    fontSize: typography.fontSize.body,
    color: colors.white,
    fontWeight: 'bold',
  },
});

export default GroupChatListScreen;