/**
 * @fileoverview Message Reaction Picker Component
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { colors, spacing, typography } from '../theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MessageReactionPickerProps {
  onReaction: (emoji: string) => void;
  onClose: () => void;
}

const REACTION_EMOJIS = [
  '👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉', '👏', '🔥',
  '💯', '⭐', '✅', '❌', '🤔', '🙄', '😍', '🤩', '😎', '🤝'
];

export const MessageReactionPicker: React.FC<MessageReactionPickerProps> = ({
  onReaction,
  onClose,
}) => {
  const handleReaction = (emoji: string) => {
    onReaction(emoji);
    onClose();
  };

  const renderEmojiGrid = () => {
    return (
      <View style={styles.emojiGrid}>
        {REACTION_EMOJIS.map((emoji, index) => (
          <TouchableOpacity
            key={index}
            style={styles.emojiButton}
            onPress={() => handleReaction(emoji)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>React to message</Text>
          </View>
          
          {renderEmojiGrid()}
          
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    maxWidth: screenWidth * 0.9,
    maxHeight: screenHeight * 0.7,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.h3,
    color: colors.text.primary,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emojiButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    margin: spacing.xs,
    borderRadius: 25,
    backgroundColor: colors.background.primary,
  },
  emoji: {
    fontSize: 28,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: typography.fontSize.body,
    color: colors.text.secondary,
  },
});

export default MessageReactionPicker;