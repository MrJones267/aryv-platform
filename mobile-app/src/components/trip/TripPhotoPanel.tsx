/**
 * @fileoverview The other person's face photo from today, on a booking
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 *
 * The passenger takes a photo when booking and the driver when accepting.
 * Once the booking is confirmed each sees the other's here, next to the
 * profile photo, so they can check who is actually getting into the car.
 * The server deletes both a day after the trip.
 *
 * It also lets you add or retake your own: an upload can fail, and a booking
 * confirmed by payment never went through the driver's Accept.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ridesApi } from '../../services/api/ridesApi';
import type { TripPhotoRole, TripPhotoSummary } from '../../services/api/ridesApi';
import { getAccessToken } from '../../services/sessionTokens';
import { takeFaceSelfie } from '../../utils/takeFaceSelfie';
import { colors } from '../../theme';
import { useI18n } from '../../i18n/I18nContext';
import logger from '../../services/LoggingService';

const log = logger.createLogger('TripPhotoPanel');

interface TripPhotoPanelProps {
  bookingId: string;
  /** Whose photo to show: the passenger's to a driver, the driver's to a passenger. */
  otherRole: TripPhotoRole;
  /** Shown over the photo, e.g. the other person's first name. */
  otherName?: string;
  /** Changes when the booking does (e.g. its status), to load again. */
  refreshKey?: string;
}

const timeOf = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const TripPhotoPanel: React.FC<TripPhotoPanelProps> = ({ bookingId, otherRole, otherName, refreshKey }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [other, setOther] = useState<TripPhotoSummary | null>(null);
  const [mine, setMine] = useState<TripPhotoSummary | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Before confirmation the server shares only your own photo.
  const [confirmed, setConfirmed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, accessToken] = await Promise.all([ridesApi.getTripPhotos(bookingId), getAccessToken()]);
      setToken(accessToken);
      if (res.success && res.data) {
        setOther(res.data.photos.find((p) => p.role === otherRole) ?? null);
        setMine(res.data.photos.find((p) => p.role === res.data!.myRole) ?? null);
        setConfirmed(res.data.bookingStatus === 'confirmed');
        setImageFailed(false);
      }
    } catch (error) {
      log.warn('Could not load trip photos', error);
    } finally {
      setLoading(false);
    }
  }, [bookingId, otherRole]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleTakeMine = async (): Promise<void> => {
    const uri = await takeFaceSelfie(t, t('tripPhoto.retakePurpose'));
    if (!uri) {return;}
    setUploading(true);
    try {
      const res = await ridesApi.uploadTripPhoto(bookingId, uri);
      if (res.success && res.data) {setMine(res.data);}
      else {Alert.alert(t('common.error'), t('photo.uploadFailed'));}
    } catch (error) {
      log.warn('Trip photo upload failed', error);
      Alert.alert(t('common.error'), t('photo.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const title = otherRole === 'driver' ? t('tripPhoto.driverToday') : t('tripPhoto.passengerToday');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{otherName ? `${title} · ${otherName}` : title}</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : (
        <View style={styles.row}>
          {other && token && !imageFailed ? (
            <Image
              source={{ uri: ridesApi.tripPhotoUrl(bookingId, otherRole), headers: { Authorization: `Bearer ${token}` } }}
              style={styles.photo}
              onError={() => setImageFailed(true)}
              accessibilityLabel={title}
            />
          ) : (
            <View style={[styles.photo, styles.placeholder]}>
              <Icon name="face" size={36} color={colors.text.secondary} />
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.status}>
              {!confirmed
                ? t('tripPhoto.sharedOnceAccepted')
                : other
                  ? t('tripPhoto.takenAt', { time: timeOf(other.takenAt) })
                  : t('tripPhoto.notYet')}
            </Text>
            {imageFailed && (
              <TouchableOpacity onPress={load} accessibilityRole="button">
                <Text style={styles.link}>{t('common.retry')}</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.hint}>{t('tripPhoto.checkHint')}</Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.mineButton}
        onPress={handleTakeMine}
        disabled={uploading}
        accessibilityRole="button"
      >
        {uploading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <Icon name={mine ? 'check-circle' : 'photo-camera'} size={18} color={mine ? colors.success : colors.primary} />
            <Text style={styles.mineText}>
              {mine ? t('tripPhoto.yoursSentRetake') : t('tripPhoto.addYours')}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: 14,
    marginVertical: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 10,
  },
  spinner: {
    marginVertical: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.background.secondary,
    marginRight: 14,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  status: {
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  mineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors.primary + '15',
    minHeight: 32,
  },
  mineText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default TripPhotoPanel;
