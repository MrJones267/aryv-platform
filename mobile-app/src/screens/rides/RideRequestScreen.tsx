/**
 * @fileoverview Post a ride request, and follow the ones already posted
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2026-10-30
 *
 * Reached from Search when no ride fits. The passenger says where from,
 * where to, when, how many seats and what they will pay; drivers near the
 * pickup see the request, and the passenger is told when a fitting ride is
 * published. Matching rides are booked through the normal booking screen.
 *
 * This replaces an "AI matching" screen that scored rides on driver
 * details the server never sends, and whose "Request Sent!" sent nothing.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button, Card } from '../../components/ui';
import { LocationPicker } from '../../components/maps';
import locationService, { LocationData } from '../../services/LocationService';
import { ridesApi } from '../../services/api';
import type { RideRequest } from '../../services/api/ridesApi';
import { colors } from '../../theme';
import logger from '../../services/LoggingService';
import { useI18n } from '../../i18n/I18nContext';

const log = logger.createLogger('RideRequestScreen');

// Constants
const CONSTANTS = {
  MAX_SEATS: 8,
  DEFAULT_LEAD_MS: 60 * 60 * 1000,
};

interface RideRequestScreenProps {
  navigation?: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
  /** origin and destination: what was typed on Search. */
  route?: { params?: Record<string, unknown> };
}

type MatchRide = { id: string; departureTime: string; pricePerSeat: number; availableSeats: number; originAddress?: string; destinationAddress?: string; driver?: { firstName?: string } };

const addressOf = (l: LocationData | null) => l?.address?.fullAddress || l?.address?.formatted || '';

const RideRequestScreen: React.FC<RideRequestScreenProps> = ({ navigation, route }) => {
  const { t } = useI18n();
  const typedOrigin = typeof route?.params?.['origin'] === 'string' ? route.params['origin'] as string : undefined;
  const typedDestination = typeof route?.params?.['destination'] === 'string' ? route.params['destination'] as string : undefined;
  const [origin, setOrigin] = useState<LocationData | null>(null);
  const [destination, setDestination] = useState<LocationData | null>(null);
  const [picking, setPicking] = useState<'origin' | 'destination' | null>(null);
  const [departure, setDeparture] = useState(new Date(Date.now() + CONSTANTS.DEFAULT_LEAD_MS));
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [seats, setSeats] = useState(1);
  const [maxPrice, setMaxPrice] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Record<string, MatchRide[] | 'loading'>>({});

  const load = useCallback(async () => {
    try {
      const res = await ridesApi.getMyRideRequests();
      if (res.success && res.data) {setRequests(res.data.requests);}
    } catch (error) {
      log.warn('Could not load ride requests', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Search hands over what was typed; turn it into places where we can.
  useEffect(() => {
    const prefill = async (text: string | undefined, set: (l: LocationData) => void) => {
      if (!text?.trim()) {return;}
      try {
        const found = await locationService.geocodeAddress(text);
        if (found) {set({ longitude: found[0], latitude: found[1], address: { fullAddress: text } });}
      } catch (error) {
        log.info('Could not place search text', error);
      }
    };
    prefill(typedOrigin, setOrigin);
    prefill(typedDestination, setDestination);
  }, [typedOrigin, typedDestination]);

  const submit = async () => {
    if (!origin || !destination) {
      Alert.alert(t('rf.missingInformation'), t('rf.pleaseSelectBothPickupAnd'));
      return;
    }
    if (departure.getTime() <= Date.now()) {
      Alert.alert(t('rf.formError'), t('rf.departureTimeMustBeIn'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await ridesApi.createRideRequest({
        origin: { latitude: origin.latitude, longitude: origin.longitude, address: addressOf(origin) },
        destination: { latitude: destination.latitude, longitude: destination.longitude, address: addressOf(destination) },
        departureTime: departure.toISOString(),
        passengers: seats,
        maxPrice: maxPrice.trim() ? Number(maxPrice) : null,
        description: note.trim() || undefined,
      });
      if (!res.success) {
        Alert.alert(t('rf.requestError'), res.error || t('rf.failedToSendRideRequest'));
        return;
      }
      Alert.alert(t('rq.postedTitle'), t('rq.postedBody'));
      setNote('');
      setMaxPrice('');
      await load();
    } catch (error) {
      Alert.alert(t('rf.requestError'), t('rf.failedToSendRideRequest'));
    } finally {
      setSubmitting(false);
    }
  };

  const showMatches = async (id: string) => {
    setMatches(prev => ({ ...prev, [id]: 'loading' }));
    try {
      const res = await ridesApi.getRideMatches(id);
      setMatches(prev => ({ ...prev, [id]: res.success && Array.isArray(res.data) ? (res.data as unknown as MatchRide[]) : [] }));
    } catch {
      setMatches(prev => ({ ...prev, [id]: [] }));
    }
  };

  const cancel = (id: string) => {
    Alert.alert(t('rq.cancelTitle'), t('rq.cancelBody'), [
      { text: t('myRides.no'), style: 'cancel' },
      {
        text: t('myRides.yesCancel'),
        style: 'destructive',
        onPress: async () => {
          const res = await ridesApi.cancelRideRequest(id);
          if (!res.success) {Alert.alert(t('common.error'), res.error || t('rq.cancelFailed'));}
          await load();
        },
      },
    ]);
  };

  const when = (iso: string | Date) => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const renderPlace = (which: 'origin' | 'destination') => {
    const value = which === 'origin' ? origin : destination;
    return (
      <TouchableOpacity style={styles.placeRow} onPress={() => setPicking(which)}>
        <Icon name={which === 'origin' ? 'trip-origin' : 'place'} size={20} color={which === 'origin' ? colors.primary : colors.success} />
        <Text style={[styles.placeText, !value && styles.placeholder]} numberOfLines={1}>
          {value ? addressOf(value) || t('rf.unknownLocation') : which === 'origin' ? t('rf.pickupLocation') : t('rf.whereTo')}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderRequest = (r: RideRequest) => {
    const m = matches[r.id];
    const active = r.status === 'active';
    return (
      <Card key={r.id} style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <Text style={styles.route} numberOfLines={2}>{r.origin.address} → {r.destination.address}</Text>
          <Text style={[styles.status, !active && styles.statusInactive]}>{t(`rq.status.${r.status}` as 'rq.status.active')}</Text>
        </View>
        <Text style={styles.meta}>
          {when(r.departureTime)} · {r.passengers === 1 ? t('myRides.seatOne') : t('myRides.seatMany', { count: r.passengers })}
          {r.maxPrice != null ? ` · ${t('rq.upTo', { price: r.maxPrice })}` : ''}
        </Text>
        {active && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => showMatches(r.id)} style={styles.action}>
              <Icon name="search" size={18} color={colors.primary} />
              <Text style={styles.actionText}>{t('rq.seeRides')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => cancel(r.id)} style={styles.action}>
              <Icon name="close" size={18} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {m === 'loading' && <ActivityIndicator style={styles.spinner} color={colors.primary} />}
        {Array.isArray(m) && m.length === 0 && <Text style={styles.noMatch}>{t('rq.noRidesYet')}</Text>}
        {Array.isArray(m) && m.map(ride => (
          <TouchableOpacity key={ride.id} style={styles.match} onPress={() => navigation?.navigate('Booking', { rideId: ride.id })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.matchTitle}>{when(ride.departureTime)}{ride.driver?.firstName ? ` · ${ride.driver.firstName}` : ''}</Text>
              <Text style={styles.matchMeta}>{t('myRides.pricePerSeat', { price: ride.pricePerSeat })} · {t('search.seatsLeft', { count: ride.availableSeats })}</Text>
            </View>
            <Text style={styles.book}>{t('search.book')}</Text>
          </TouchableOpacity>
        ))}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} accessibilityLabel={t('common.back')}>
          <Icon name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('rf.requestARide')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <Card style={styles.formCard}>
          <Text style={styles.intro}>{t('rq.intro')}</Text>
          {renderPlace('origin')}
          {renderPlace('destination')}

          <View style={styles.row}>
            <TouchableOpacity style={styles.half} onPress={() => setPickerMode('date')}>
              <Icon name="event" size={18} color={colors.text.secondary} />
              <Text style={styles.placeText}>{departure.toLocaleDateString()}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.half} onPress={() => setPickerMode('time')}>
              <Icon name="schedule" size={18} color={colors.text.secondary} />
              <Text style={styles.placeText}>{departure.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{t('search.passengers')}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity onPress={() => setSeats(s => Math.max(1, s - 1))} accessibilityLabel="-"><Icon name="remove" size={22} color={colors.primary} /></TouchableOpacity>
              <Text style={styles.seats}>{seats}</Text>
              <TouchableOpacity onPress={() => setSeats(s => Math.min(CONSTANTS.MAX_SEATS, s + 1))} accessibilityLabel="+"><Icon name="add" size={22} color={colors.primary} /></TouchableOpacity>
            </View>
          </View>

          <TextInput
            style={styles.input}
            value={maxPrice}
            onChangeText={v => setMaxPrice(v.replace(/[^0-9.]/g, ''))}
            placeholder={t('rq.maxPricePlaceholder')}
            placeholderTextColor={colors.text.secondary}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.note]}
            value={note}
            onChangeText={setNote}
            placeholder={t('rq.notePlaceholder')}
            placeholderTextColor={colors.text.secondary}
            maxLength={500}
            multiline
          />
          <Button title={t('rq.post')} onPress={submit} loading={submitting} disabled={submitting} fullWidth />
        </Card>

        <Text style={styles.sectionTitle}>{t('rq.yourRequests')}</Text>
        {loading ? <ActivityIndicator color={colors.primary} /> : requests.length === 0
          ? <Text style={styles.noMatch}>{t('rq.none')}</Text>
          : requests.map(renderRequest)}
      </ScrollView>

      <LocationPicker
        visible={picking !== null}
        onClose={() => setPicking(null)}
        onLocationSelect={l => { (picking === 'origin' ? setOrigin : setDestination)(l); setPicking(null); }}
        title={picking === 'origin' ? t('rf.selectPickupLocation') : t('rf.selectDestination')}
      />
      {pickerMode && (
        <DateTimePicker
          value={departure}
          mode={pickerMode}
          display="default"
          minimumDate={pickerMode === 'date' ? new Date() : undefined}
          onChange={(_e, d) => { setPickerMode(null); if (d) {setDeparture(d);} }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },
  content: { padding: 16, paddingBottom: 40 },
  formCard: { marginBottom: 20 },
  intro: { fontSize: 14, color: colors.text.secondary, marginBottom: 12, lineHeight: 20 },
  placeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  placeText: { flex: 1, marginLeft: 10, fontSize: 15, color: colors.text.primary },
  placeholder: { color: colors.text.secondary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  half: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginRight: 8 },
  label: { fontSize: 15, color: colors.text.primary },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  seats: { fontSize: 16, fontWeight: '600', marginHorizontal: 16, color: colors.text.primary },
  input: { borderWidth: 1, borderColor: colors.border.light, borderRadius: 8, padding: 12, marginTop: 12, fontSize: 15, color: colors.text.primary },
  note: { minHeight: 70, textAlignVertical: 'top', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary, marginBottom: 10 },
  requestCard: { marginBottom: 12 },
  requestHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  route: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text.primary, marginRight: 8 },
  status: { fontSize: 12, fontWeight: '600', color: colors.success, textTransform: 'uppercase' },
  statusInactive: { color: colors.text.secondary },
  meta: { fontSize: 13, color: colors.text.secondary, marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: 10 },
  action: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  actionText: { marginLeft: 4, fontSize: 14, color: colors.primary, fontWeight: '500' },
  spinner: { marginTop: 10 },
  noMatch: { fontSize: 14, color: colors.text.secondary, marginTop: 8 },
  match: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border.light, marginTop: 8 },
  matchTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  matchMeta: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  book: { fontSize: 14, fontWeight: '600', color: colors.primary },
});

export default RideRequestScreen;
