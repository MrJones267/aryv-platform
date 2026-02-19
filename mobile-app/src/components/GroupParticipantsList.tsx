/**
 * @fileoverview Group Participants List Component
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { GroupChatService } from '../services/GroupChatService';
import { useAppSelector } from '../store/hooks';
const useAuth = () => {
  const profile = useAppSelector(state => state.user.profile);
  return { user: { id: profile?.id || '', firstName: profile?.firstName || '', lastName: profile?.lastName || '' } };
};
import { colors, spacing, typography } from '../theme';
import logger from '../services/LoggingService';

const log = logger.createLogger('GroupParticipantsList');

interface Participant {
  id: string;
  userId: string;
  role: 'admin' | 'moderator' | 'member';
  status: 'active' | 'muted' | 'blocked';
  nickname?: string;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

interface GroupParticipantsListProps {
  groupChatId: string;
  onClose: () => void;
}

export const GroupParticipantsList: React.FC<GroupParticipantsListProps> = ({
  groupChatId,
  onClose,
}) => {
  const { user: currentUser } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');

  useEffect(() => {
    loadParticipants();
  }, [groupChatId]);

  const loadParticipants = async () => {
    try {
      setLoading(true);
      const response = await GroupChatService.getGroupParticipants(groupChatId);
      
      if (response.success && response.data) {
        const data = response.data as { participants?: Participant[] };
        setParticipants(data.participants || []);

        // Find current user's role
        const currentParticipant = data.participants?.find(
          (p: Participant) => p.userId === currentUser?.id
        );
        if (currentParticipant) {
          setCurrentUserRole(currentParticipant.role);
        }
      }
    } catch (error) {
      log.error('Error loading participants:', error);
      Alert.alert('Error', 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  };

  const canModerate = () => {
    return currentUserRole === 'admin' || currentUserRole === 'moderator';
  };

  const canPromote = (participantRole: string) => {
    if (currentUserRole === 'admin') return true;
    if (currentUserRole === 'moderator' && participantRole === 'member') return true;
    return false;
  };

  const handleParticipantAction = (participant: Participant, action: string) => {
    Alert.alert(
      'Participant Action',
      `Are you sure you want to ${action} ${participant.user.firstName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: action === 'remove' ? 'destructive' : 'default',
          onPress: () => executeParticipantAction(participant, action),
        },
      ]
    );
  };

  const executeParticipantAction = async (participant: Participant, action: string) => {
    try {
      let updates: Record<string, string> = {};

      switch (action) {
        case 'promote':
          updates.role = participant.role === 'member' ? 'moderator' : 'admin';
          break;
        case 'demote':
          updates.role = participant.role === 'admin' ? 'moderator' : 'member';
          break;
        case 'mute':
          updates.status = 'muted';
          break;
        case 'unmute':
          updates.status = 'active';
          break;
        case 'remove':
          updates.status = 'removed';
          break;
        default:
          return;
      }

      const response = await GroupChatService.updateParticipant(
        groupChatId,
        participant.id,
        updates
      );

      if (response.success) {
        loadParticipants(); // Reload to get updated data
        Alert.alert('Success', `Participant ${action}d successfully`);
      }
    } catch (error) {
      log.error('Error updating participant:', error);
      Alert.alert('Error', `Failed to ${action} participant`);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Icon name="admin-panel-settings" size={16} color={colors.error} />;
      case 'moderator':
        return <Icon name="shield" size={16} color={colors.warning} />;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'muted':
        return <Icon name="volume-mute" size={16} color={colors.textSecondary} />;
      case 'blocked':
        return <Icon name="ban" size={16} color={colors.error} />;
      default:
        return null;
    }
  };

  const renderParticipantActions = (participant: Participant) => {
    if (participant.userId === currentUser?.id) return null;
    if (!canModerate()) return null;

    const actions = [];

    // Role management
    if (canPromote(participant.role)) {
      actions.push(
        <TouchableOpacity
          key="promote"
          style={styles.actionButton}
          onPress={() => handleParticipantAction(participant, 'promote')}
        >
          <Icon name="keyboard-arrow-up" size={20} color={colors.success} />
        </TouchableOpacity>
      );
    }

    if (participant.role !== 'member' && currentUserRole === 'admin') {
      actions.push(
        <TouchableOpacity
          key="demote"
          style={styles.actionButton}
          onPress={() => handleParticipantAction(participant, 'demote')}
        >
          <Icon name="keyboard-arrow-down" size={20} color={colors.warning} />
        </TouchableOpacity>
      );
    }

    // Mute/unmute
    if (participant.status === 'active') {
      actions.push(
        <TouchableOpacity
          key="mute"
          style={styles.actionButton}
          onPress={() => handleParticipantAction(participant, 'mute')}
        >
          <Icon name="volume-mute" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      );
    } else if (participant.status === 'muted') {
      actions.push(
        <TouchableOpacity
          key="unmute"
          style={styles.actionButton}
          onPress={() => handleParticipantAction(participant, 'unmute')}
        >
          <Icon name="volume-high" size={20} color={colors.success} />
        </TouchableOpacity>
      );
    }

    // Remove
    if (currentUserRole === 'admin' || (currentUserRole === 'moderator' && participant.role === 'member')) {
      actions.push(
        <TouchableOpacity
          key="remove"
          style={styles.actionButton}
          onPress={() => handleParticipantAction(participant, 'remove')}
        >
          <Icon name="person-remove" size={20} color={colors.error} />
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.actionsContainer}>
        {actions}
      </View>
    );
  };

  const renderParticipant = ({ item }: { item: Participant }) => (
    <View style={styles.participantItem}>
      <View style={styles.participantInfo}>
        <View style={styles.avatarContainer}>
          {item.user.profilePicture ? (
            <Image source={{ uri: item.user.profilePicture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {getInitials(item.user.firstName, item.user.lastName)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.participantDetails}>
          <View style={styles.nameRow}>
            <Text style={styles.participantName}>
              {item.nickname || `${item.user.firstName} ${item.user.lastName}`}
            </Text>
            {item.userId === currentUser?.id && (
              <Text style={styles.youLabel}>(You)</Text>
            )}
          </View>
          
          <View style={styles.statusRow}>
            {getRoleIcon(item.role)}
            {getStatusIcon(item.status)}
            <Text style={styles.roleText}>{item.role}</Text>
          </View>
        </View>
      </View>

      {renderParticipantActions(item)}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Icon name="close" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>
        Participants ({participants.length})
      </Text>
      
      <TouchableOpacity style={styles.addButton}>
        <Icon name="person-add" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading participants...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      <FlatList
        data={participants}
        renderItem={renderParticipant}
        keyExtractor={(item) => item.id}
        style={styles.participantsList}
        contentContainerStyle={styles.participantsContent}
        showsVerticalScrollIndicator={false}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  addButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  participantsList: {
    flex: 1,
  },
  participantsContent: {
    paddingVertical: spacing.sm,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.body,
    color: colors.white,
    fontWeight: 'bold',
  },
  participantDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantName: {
    fontSize: typography.fontSize.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  youLabel: {
    fontSize: typography.fontSize.caption,
    color: colors.primary,
    marginLeft: spacing.xs,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  roleText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    textTransform: 'capitalize',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});

export default GroupParticipantsList;