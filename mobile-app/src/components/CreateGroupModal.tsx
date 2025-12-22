/**
 * @fileoverview Create Group Modal Component
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing, typography } from '../theme';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateGroup: (groupData: any) => void;
}

const GROUP_TYPES = [
  {
    key: 'custom_group',
    label: 'Custom Group',
    description: 'General purpose group chat',
    icon: 'group',
    color: colors.primary,
  },
  {
    key: 'ride_group',
    label: 'Ride Group',
    description: 'For ride sharing discussions',
    icon: 'directions-car',
    color: colors.info,
  },
  {
    key: 'delivery_group',
    label: 'Delivery Group',
    description: 'For package delivery coordination',
    icon: 'local-shipping',
    color: colors.warning,
  },
  {
    key: 'emergency_group',
    label: 'Emergency Group',
    description: 'For emergency communications',
    icon: 'emergency',
    color: colors.error,
  },
];

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  visible,
  onClose,
  onCreateGroup,
}) => {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState('custom_group');
  const [isPublic, setIsPublic] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState('50');
  const [creating, setCreating] = useState(false);

  const resetForm = () => {
    setGroupName('');
    setDescription('');
    setSelectedType('custom_group');
    setIsPublic(false);
    setMaxParticipants('50');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateForm = () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return false;
    }

    if (groupName.length < 3) {
      Alert.alert('Error', 'Group name must be at least 3 characters long');
      return false;
    }

    if (groupName.length > 50) {
      Alert.alert('Error', 'Group name must be less than 50 characters');
      return false;
    }

    const maxParticipantsNum = parseInt(maxParticipants);
    if (isNaN(maxParticipantsNum) || maxParticipantsNum < 2 || maxParticipantsNum > 500) {
      Alert.alert('Error', 'Max participants must be between 2 and 500');
      return false;
    }

    return true;
  };

  const handleCreateGroup = async () => {
    if (!validateForm()) return;

    try {
      setCreating(true);

      const groupData = {
        name: groupName.trim(),
        description: description.trim() || undefined,
        type: selectedType,
        isPublic,
        maxParticipants: parseInt(maxParticipants),
      };

      await onCreateGroup(groupData);
      resetForm();
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setCreating(false);
    }
  };

  const renderGroupTypeOption = (type: any) => (
    <TouchableOpacity
      key={type.key}
      style={[
        styles.typeOption,
        selectedType === type.key && styles.typeOptionSelected,
      ]}
      onPress={() => setSelectedType(type.key)}
    >
      <View style={styles.typeIconContainer}>
        <MaterialIcon name={type.icon} size={24} color={type.color} />
      </View>
      <View style={styles.typeContent}>
        <Text style={styles.typeLabel}>{type.label}</Text>
        <Text style={styles.typeDescription}>{type.description}</Text>
      </View>
      <View style={styles.radioContainer}>
        <View
          style={[
            styles.radioButton,
            selectedType === type.key && styles.radioButtonSelected,
          ]}
        >
          {selectedType === type.key && (
            <View style={styles.radioButtonInner} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>Create Group</Text>
          
          <TouchableOpacity
            style={[
              styles.createButton,
              (!groupName.trim() || creating) && styles.createButtonDisabled,
            ]}
            onPress={handleCreateGroup}
            disabled={!groupName.trim() || creating}
          >
            <Text
              style={[
                styles.createText,
                (!groupName.trim() || creating) && styles.createTextDisabled,
              ]}
            >
              {creating ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Group Name *</Text>
              <TextInput
                style={styles.textInput}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Enter group name"
                placeholderTextColor={colors.textSecondary}
                maxLength={50}
              />
              <Text style={styles.characterCount}>
                {groupName.length}/50
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="What's this group about?"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
              <Text style={styles.characterCount}>
                {description.length}/200
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Type</Text>
            {GROUP_TYPES.map(renderGroupTypeOption)}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Settings</Text>
            
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setIsPublic(!isPublic)}
            >
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Public Group</Text>
                <Text style={styles.settingDescription}>
                  Anyone can find and join this group
                </Text>
              </View>
              <View
                style={[
                  styles.switch,
                  isPublic && styles.switchActive,
                ]}
              >
                <View
                  style={[
                    styles.switchThumb,
                    isPublic && styles.switchThumbActive,
                  ]}
                />
              </View>
            </TouchableOpacity>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Max Participants</Text>
              <TextInput
                style={styles.textInput}
                value={maxParticipants}
                onChangeText={setMaxParticipants}
                placeholder="50"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.inputHint}>
                Between 2 and 500 participants
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
  cancelButton: {
    padding: spacing.xs,
  },
  cancelText: {
    fontSize: typography.fontSize.body,
    color: colors.textSecondary,
  },
  title: {
    fontSize: typography.fontSize.h3,
    color: colors.text.primary,
  },
  createButton: {
    padding: spacing.xs,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createText: {
    fontSize: typography.fontSize.body,
    color: colors.primary,
    fontWeight: 'bold',
  },
  createTextDisabled: {
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionTitle: {
    fontSize: typography.fontSize.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.body,
    color: colors.text.primary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  textInput: {
    fontSize: typography.fontSize.body,
    color: colors.text.primary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  inputHint: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing.sm,
  },
  typeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  typeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  typeContent: {
    flex: 1,
  },
  typeLabel: {
    fontSize: typography.fontSize.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  typeDescription: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
  },
  radioContainer: {
    marginLeft: spacing.sm,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: typography.fontSize.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
});

export default CreateGroupModal;