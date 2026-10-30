/**
 * @fileoverview Rides on the routes this passenger travels often.
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2026-08-23
 *
 * This screen used to render recommendations built from an invented ride
 * history — the service generated the user's own past trips around San
 * Francisco and reasoned from them — alongside a randomly generated "expected
 * savings" figure presented as money.
 *
 * What it shows now comes from the routes the user has actually completed
 * bookings on, and the real upcoming rides listed on those routes. Someone
 * with no history sees a plain explanation instead of invented suggestions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import RideRecommendationService, {
  RideRecommendation,
} from '../../services/RideRecommendationService';
import { useI18n } from '../../i18n/I18nContext';

interface RecommendationsScreenProps {
  navigation?: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

const formatDeparture = (iso: string): string => {
  const date = new Date(iso);

  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }`;
};

const RecommendationsScreen: React.FC<RecommendationsScreenProps> = ({ navigation }) => {
  const { t } = useI18n();
  const [recommendations, setRecommendations] = useState<RideRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const results = await RideRecommendationService.getRecommendations();
    setRecommendations(results);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderRoute = (recommendation: RideRecommendation) => {
    const { route, upcoming } = recommendation;

    return (
      <View key={`${route.originAddress}-${route.destinationAddress}`} style={styles.routeCard}>
        <View style={styles.routeHeader}>
          <Icon name="repeat" size={18} color="#2196F3" />
          <Text style={styles.routeTitle} numberOfLines={2}>
            {route.originAddress} → {route.destinationAddress}
          </Text>
        </View>

        {/* The count is shown so the suggestion explains itself rather than
            arriving as an unaccountable recommendation. */}
        <Text style={styles.routeMeta}>
          You have travelled this {route.tripCount} times
        </Text>

        {upcoming.length === 0 ? (
          <Text style={styles.emptyRoute}>
            {t('ui.noUpcomingRidesOnThis')}
          </Text>
        ) : (
          upcoming.map((ride) => (
            <TouchableOpacity
              key={ride.id}
              style={styles.rideRow}
              onPress={() => navigation?.navigate('RideDetails', { rideId: ride.id })}
            >
              <View style={styles.rideInfo}>
                <Text style={styles.rideTime}>{formatDeparture(ride.departureTime)}</Text>
                <Text style={styles.rideSeats}>
                  {ride.availableSeats} seat{ride.availableSeats === 1 ? '' : 's'} left
                </Text>
              </View>
              <Text style={styles.ridePrice}>P{ride.pricePerSeat}</Text>
              <Icon name="chevron-right" size={20} color="#CCCCCC" />
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('ui.ridesForYou')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {isLoading ? (
          <View style={styles.centred}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        ) : recommendations.length === 0 ? (
          // The honest state for a new passenger, rather than filling the
          // screen with journeys they have never made.
          <View style={styles.centred}>
            <Icon name="explore" size={48} color="#CCCCCC" />
            <Text style={styles.emptyTitle}>{t('ui.nothingToSuggestYet')}</Text>
            <Text style={styles.emptyBody}>
              Once you have taken a few rides, the journeys you make regularly
              will show up here with the next available seats on them.
            </Text>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => navigation?.navigate('Search')}
            >
              <Text style={styles.searchButtonText}>{t('ui.findARide')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.content}>{recommendations.map(renderRoute)}</View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333333' },
  scrollView: { flex: 1 },
  content: { padding: 16, gap: 16 },
  centred: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 64, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#333333' },
  emptyBody: { fontSize: 14, lineHeight: 20, color: '#777777', textAlign: 'center' },
  searchButton: {
    marginTop: 8,
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  searchButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333333' },
  routeMeta: { fontSize: 12, color: '#888888' },
  emptyRoute: { fontSize: 13, color: '#999999', paddingTop: 4 },
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  rideInfo: { flex: 1 },
  rideTime: { fontSize: 14, color: '#333333' },
  rideSeats: { fontSize: 12, color: '#888888', marginTop: 2 },
  ridePrice: { fontSize: 15, fontWeight: '600', color: '#2196F3' },
});

export default RecommendationsScreen;
