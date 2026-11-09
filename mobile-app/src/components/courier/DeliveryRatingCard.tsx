/**
 * @fileoverview Rate the other side of a completed delivery
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 *
 * The server took ratings both ways (POST /courier/deliveries/:id/rate), but
 * nothing in the app offered it, so no courier ever built a rating senders
 * could judge them by. Shown on a completed delivery until its side is rated.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PackageService from '../../services/PackageService';
import { colors } from '../../theme';
import { useI18n } from '../../i18n/I18nContext';

interface DeliveryRatingCardProps {
  agreementId: string;
  /** Whom the viewer is rating. */
  rating: 'courier' | 'sender';
  /** Called once the rating is saved, so the screen can stop showing this. */
  onRated?: () => void;
}

export const DeliveryRatingCard: React.FC<DeliveryRatingCardProps> = ({ agreementId, rating: whom, onRated }) => {
  const { t } = useI18n();
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (): Promise<void> => {
    if (stars < 1) {return;}
    setSending(true);
    try {
      const result = await PackageService.rateDelivery(agreementId, stars, review);
      // Already rated (say, on another phone) counts as done.
      if (result.success || result.code === 'ALREADY_RATED') {
        setDone(true);
        onRated?.();
      } else {
        Alert.alert(t('common.error'), result.error || t('deliveryRating.failed'));
      }
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.card, styles.doneRow]}>
        <Icon name="check-circle" size={20} color={colors.success} />
        <Text style={styles.doneText}>{t('deliveryRating.thanks')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {whom === 'courier' ? t('deliveryRating.rateCourier') : t('deliveryRating.rateSender')}
      </Text>
      <View style={styles.stars} accessibilityRole="adjustable">
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => setStars(n)}
            accessibilityRole="button"
            accessibilityLabel={t('deliveryRating.starsLabel', { count: n })}
            style={styles.starButton}
          >
            <Icon name={n <= stars ? 'star' : 'star-border'} size={34} color={n <= stars ? '#F59E0B' : colors.text.secondary} />
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={review}
        onChangeText={setReview}
        placeholder={t('deliveryRating.commentPlaceholder')}
        placeholderTextColor={colors.text.secondary}
        maxLength={1000}
        multiline
      />
      <TouchableOpacity
        style={[styles.submit, (stars < 1 || sending) && styles.submitDisabled]}
        onPress={submit}
        disabled={stars < 1 || sending}
        accessibilityRole="button"
      >
        {sending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{t('deliveryRating.submit')}</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: 16,
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    fontSize: 14,
    color: colors.text.primary,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doneText: {
    fontSize: 14,
    color: colors.text.primary,
  },
});

export default DeliveryRatingCard;
