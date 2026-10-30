/**
 * @fileoverview Ride requests near a driver, and offering the ride
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Passengers who found no ride post what they need. Drivers with approved
 * documents see the open ones near them here; "Offer this ride" opens
 * Create Ride filled in from the request, and publishing it tells the
 * passenger.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Card } from '../../components/ui';
import locationService from '../../services/LocationService';
import { ridesApi } from '../../services/api';
import type { NearbyRideRequest } from '../../services/api/ridesApi';
import { colors } from '../../theme';
import logger from '../../services/LoggingService';
import { useI18n } from '../../i18n/I18nContext';

const log = logger.createLogger('RideRequestsNearbyScreen');

interface Props {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

type LoadState = 'loading' | 'ready' | 'no_location' | 'not_verified' | 'error';

const RideRequestsNearbyScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useI18n();
  const [state, setState] = useState<LoadState>('loading');
  const [requests, setRequests] = useState<NearbyRideRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let here: { latitude: number; longitude: number };
    try {
      here = await locationService.getCurrentLocation();
    } catch (error) {
      log.warn('No location for nearby requests', error);
      setState('no_location');
      return;
    }
    try {
      const res = await ridesApi.getNearbyRideRequests(here.latitude, here.longitude);
      if (res.success && Array.isArray(res.data)) {
        setRequests(res.data);
        setState('ready');
      } else {
        setState(/DRIVER_NOT_VERIFIED|403|approved/i.test(String(res.error)) ? 'not_verified' : 'error');
      }
    } catch (error) {
      log.warn('Could not load nearby requests', error);
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const offer = (r: NearbyRideRequest) => {
    navigation.navigate('CreateRide', {
      prefill: {
        origin: r.origin.coordinates ? { longitude: r.origin.coordinates[0], latitude: r.origin.coordinates[1], address: r.origin.address } : null,
        destination: r.destination.coordinates ? { longitude: r.destination.coordinates[0], latitude: r.destination.coordinates[1], address: r.destination.address } : null,
        departureTime: r.departureTime,
        seats: r.passengers,
      },
    });
  };

  const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const renderItem = ({ item: r }: { item: NearbyRideRequest }) => (
    <Card style={styles.card}>
      <Text style={styles.route} numberOfLines={2}>{r.origin.address} → {r.destination.address}</Text>
      <Text style={styles.meta}>
        {when(r.departureTime)} · {r.passengers === 1 ? t('myRides.seatOne') : t('myRides.seatMany', { count: r.passengers })}
        {r.maxPrice != null ? ` · ${t('rq.upTo', { price: r.maxPrice })}` : ''}
      </Text>
      <Text style={styles.meta}>{t('rq.passengerKmAway', { name: r.passengerFirstName, km: r.distanceKm })}</Text>
      {!!r.description && <Text style={styles.note}>“{r.description}”</Text>}
      <TouchableOpacity style={styles.offer} onPress={() => offer(r)}>
        <Icon name="directions-car" size={18} color="#FFFFFF" />
        <Text style={styles.offerText}>{t('rq.offerThisRide')}</Text>
      </TouchableOpacity>
    </Card>
  );

  const message = (text: string) => <Text style={styles.empty}>{text}</Text>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('common.back')}>
          <Icon name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('rq.nearbyTitle')}</Text>
        <View style={{ width: 24 }} />
      </View>
      {state === 'loading' ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <FlatList
          data={state === 'ready' ? requests : []}
          keyExtractor={r => r.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListHeaderComponent={state === 'ready' && requests.length > 0 ? <Text style={styles.intro}>{t('rq.nearbyIntro')}</Text> : null}
          ListEmptyComponent={
            state === 'no_location' ? message(t('rq.needLocation'))
              : state === 'not_verified' ? message(t('rq.needVerification'))
                : state === 'error' ? message(t('rq.loadFailed'))
                  : message(t('rq.noneNearby'))
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },
  list: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 14, color: colors.text.secondary, marginBottom: 12, lineHeight: 20 },
  card: { marginBottom: 12 },
  route: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  meta: { fontSize: 13, color: colors.text.secondary, marginTop: 4 },
  note: { fontSize: 13, color: colors.text.primary, fontStyle: 'italic', marginTop: 6 },
  offer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 10 },
  offerText: { color: '#FFFFFF', fontWeight: '600', marginLeft: 6 },
  empty: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },
});

export default RideRequestsNearbyScreen;
