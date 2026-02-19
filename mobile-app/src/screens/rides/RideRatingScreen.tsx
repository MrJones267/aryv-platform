/**
 * @fileoverview Post-ride rating screen for rating drivers/passengers
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import { ridesApi } from '../../services/api';
import { haptic } from '../../services/HapticService';
import TipSelector from '../../components/payment/TipSelector';
import ReceiptService, { RideReceipt } from '../../services/ReceiptService';
import RideReceiptCard from '../../components/payment/RideReceiptCard';
import logger from '../../services/LoggingService';

const log = logger.createLogger('RideRatingScreen');

interface RideRatingScreenProps {
  navigation?: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void; popToTop: () => void };
  route?: {
    params: {
      rideId: string;
      driverId?: string;
      driverName?: string;
      origin?: string;
      destination?: string;
      rideFare?: number;
      currency?: string;
      role?: 'passenger' | 'driver';
    };
  };
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Below Average',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
};

const QUICK_TAGS = {
  passenger: [
    'Smooth ride',
    'Great conversation',
    'On time',
    'Clean vehicle',
    'Safe driving',
    'Helpful with luggage',
  ],
  driver: [
    'Polite passenger',
    'On time',
    'Respectful',
    'Good communicator',
    'Clean',
    'Easy pickup',
  ],
};

const RideRatingScreen: React.FC<RideRatingScreenProps> = ({ navigation, route }) => {
  const {
    rideId = '',
    driverId = '',
    driverName = 'your travel companion',
    origin = '',
    destination = '',
    rideFare = 0,
    currency = 'BWP',
    role = 'passenger',
  } = route?.params ?? {};

  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [tipHandled, setTipHandled] = useState(false);
  const [receipt, setReceipt] = useState<RideReceipt | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const ratingTarget = role === 'passenger' ? 'driver' : 'passenger';
  const tags = role === 'passenger' ? QUICK_TAGS.passenger : QUICK_TAGS.driver;

  const handleStarPress = (star: number) => {
    haptic.selection();
    setRating(star);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  };

  const generateReceipt = async () => {
    const receiptService = ReceiptService.getInstance();
    const generatedReceipt = receiptService.generateReceipt({
      rideId,
      origin,
      destination,
      driverName,
      baseFare: rideFare,
      tipAmount,
      currency,
    });
    await receiptService.saveReceipt(generatedReceipt);
    setReceipt(generatedReceipt);
    setShowReceipt(true);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      await ridesApi.rateRide(rideId, {
        rating,
        tags: selectedTags,
        comment: comment.trim(),
        role: ratingTarget,
      });

      haptic.confirm();
      // Generate receipt and show it instead of immediately navigating away
      if (rideFare > 0 && role === 'passenger') {
        await generateReceipt();
      } else {
        Alert.alert('Thank You!', 'Your rating has been submitted.', [
          { text: 'OK', onPress: () => navigation?.popToTop() },
        ]);
      }
    } catch (error) {
      log.info('Rating submission error:', error);
      // Still generate receipt if possible
      if (rideFare > 0 && role === 'passenger') {
        await generateReceipt();
      } else {
        Alert.alert('Rating Saved', 'Your rating will be submitted when connected.', [
          { text: 'OK', onPress: () => navigation?.popToTop() },
        ]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigation?.popToTop();
  };

  // Receipt view after submission
  if (showReceipt && receipt) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />
        <ScrollView
          contentContainerStyle={styles.receiptScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.receiptHeader}>
            <View style={styles.receiptCheckCircle}>
              <Icon name="check" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.receiptThankYou}>Thank you!</Text>
            <Text style={styles.receiptSubtext}>Your rating has been submitted</Text>
          </View>
          <RideReceiptCard receipt={receipt} />
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => navigation?.popToTop()}
            activeOpacity={0.8}
          >
            <Text style={styles.submitBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Rate Your Trip</Text>
            {origin && destination ? (
              <View style={styles.routeRow}>
                <Text style={styles.routeText} numberOfLines={1}>
                  {origin}
                </Text>
                <Icon name="arrow-forward" size={16} color={colors.text.secondary} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {destination}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Avatar + name */}
          <View style={styles.profileSection}>
            <View style={styles.avatarCircle}>
              <Icon name="person" size={36} color={colors.primary} />
            </View>
            <Text style={styles.profileName}>
              How was your trip with {driverName}?
            </Text>
          </View>

          {/* Stars */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleStarPress(star)}
                activeOpacity={0.6}
                style={styles.starBtn}
              >
                <Icon
                  name={star <= rating ? 'star' : 'star-border'}
                  size={44}
                  color={star <= rating ? '#F59E0B' : colors.border.medium}
                />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
          )}

          {/* Quick tags */}
          {rating > 0 && (
            <View style={styles.tagsSection}>
              <Text style={styles.tagsSectionTitle}>What went well?</Text>
              <View style={styles.tagsGrid}>
                {tags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tag, isSelected && styles.tagSelected]}
                      onPress={() => handleTagToggle(tag)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Comment */}
          {rating > 0 && (
            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>Additional comments (optional)</Text>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Share more details about your experience..."
                placeholderTextColor={colors.text.secondary}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{comment.length}/500</Text>
            </View>
          )}

          {/* Tip section — only for passengers rating drivers */}
          {rating > 0 && role === 'passenger' && !tipHandled && (
            <View style={styles.tipSection}>
              <View style={styles.tipDivider} />
              <TipSelector
                rideId={rideId}
                driverId={driverId}
                rideFare={rideFare}
                currency={currency}
                onTipSubmitted={(amount) => {
                  setTipAmount(amount);
                  setTipHandled(true);
                }}
                onSkip={() => setTipHandled(true)}
              />
            </View>
          )}

          {/* Tip confirmation badge */}
          {tipHandled && tipAmount > 0 && (
            <View style={styles.tipBadge}>
              <Icon name="favorite" size={16} color="#10B981" />
              <Text style={styles.tipBadgeText}>
                {currency} {tipAmount} tip added
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              rating === 0 && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || rating === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.submitBtnText}>
              {isSubmitting ? 'Submitting...' : 'Submit Rating'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    maxWidth: '90%',
  },
  routeText: {
    fontSize: 13,
    color: colors.text.secondary,
    flexShrink: 1,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 16,
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '500',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  starBtn: {
    padding: 4,
  },
  ratingLabel: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 24,
  },
  tagsSection: {
    marginBottom: 20,
  },
  tagsSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: '#FFFFFF',
  },
  tagSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  tagText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  tagTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  commentSection: {
    marginBottom: 16,
  },
  commentLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: 14,
    fontSize: 14,
    color: colors.text.primary,
    minHeight: 80,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipBtnText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  tipSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  tipDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginBottom: 16,
  },
  tipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#10B981' + '30',
  },
  tipBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  receiptScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  receiptCheckCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  receiptThankYou: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
  },
  receiptSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
});

export default RideRatingScreen;
