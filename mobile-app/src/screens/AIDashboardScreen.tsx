/**
 * @fileoverview How busy the area is, for a driver deciding when to travel.
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2026-08-23
 *
 * This screen previously showed a demand forecast, a wait-time estimate, an
 * optimal-price figure, a weather panel and a traffic-delay panel, all sourced
 * from a service that proxied to a Python model at localhost:5001. Nothing is
 * deployed there and the router exposing those endpoints was never mounted, so
 * every call fell through to a fallback returning fixed constants — which the
 * screen rendered as measured readings, complete with confidence percentages.
 *
 * The weather and traffic panels are gone: the platform has no weather or
 * traffic data source, and inventing one to fill a card is how the previous
 * version went wrong.
 *
 * What remains is what the database can actually answer — seats offered
 * against seats taken nearby, and when people on these routes travel — which
 * is the question a driver came here to ask anyway.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DemandService, { DemandSnapshot } from '../services/DemandService';
import locationService from '../services/LocationService';
import type { TranslationKey } from '../i18n/translations';
import { useI18n } from '../i18n/I18nContext';

interface AIDashboardScreenProps {
  navigation?: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

/** How each demand level reads, and what it means for a driver. */
const LEVELS: Record<
  DemandSnapshot['level'],
  { label: string; colour: string; advice: string }
> = {
  very_busy: {
    label: 'ui.veryBusy',
    colour: '#C62828',
    advice: 'ui.mostSeatsNearYouAre',
  },
  busy: {
    label: 'ui.busy',
    colour: '#EF6C00',
    advice: 'ui.seatsAreFillingFasterThan',
  },
  steady: {
    label: 'ui.steady',
    colour: '#2E7D32',
    advice: 'ui.aNormalAmountOfTravel',
  },
  quiet: {
    label: 'ui.quiet',
    colour: '#546E7A',
    advice: 'ui.plentyOfSeatsAreGoing',
  },
  unknown: {
    label: 'ui.notEnoughData',
    colour: '#757575',
    // Said plainly rather than defaulting to "quiet", which would send a
    // driver home on the strength of two rides.
    advice: 'ui.thereAreTooFewRides',
  },
};

const AIDashboardScreen: React.FC<AIDashboardScreenProps> = ({ navigation }) => {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<DemandSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationError, setLocationError] = useState(false);

  const load = useCallback(async () => {
    setLocationError(false);

    const position = await locationService
      .getCurrentLocation({ timeout: 8000 })
      .catch(() => null);

    if (!position) {
      setLocationError(true);
      setSnapshot(null);
      setLoading(false);
      return;
    }

    setSnapshot(await DemandService.forLocation(position.latitude, position.longitude));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /**
   * A bar per hour of the day.
   *
   * Drawn with plain views rather than a chart library: it is one series of
   * twenty-four values, and the shape is the whole message.
   */
  const renderHourlyPattern = (hourly: number[]) => {
    const peak = Math.max(...hourly, 1);
    const busiestHour = hourly.indexOf(Math.max(...hourly));
    const hasAny = hourly.some((count) => count > 0);

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('ui.whenPeopleTravel')}</Text>

        {hasAny ? (
          <>
            <Text style={styles.cardSubtitle}>
              {t('ui.seatsBookedByDepartureHour')}
            </Text>

            <View style={styles.chart}>
              {hourly.map((count, hour) => (
                <View key={hour} style={styles.barColumn}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(2, (count / peak) * 90),
                        backgroundColor: hour === busiestHour ? '#2196F3' : '#BBDEFB',
                      },
                    ]}
                  />
                </View>
              ))}
            </View>

            <View style={styles.axis}>
              <Text style={styles.axisLabel}>00:00</Text>
              <Text style={styles.axisLabel}>12:00</Text>
              <Text style={styles.axisLabel}>23:00</Text>
            </View>

            <Text style={styles.insight}>
              Busiest around {String(busiestHour).padStart(2, '0')}:00.
            </Text>
          </>
        ) : (
          <Text style={styles.emptyBody}>
            {t('ui.noCompletedBookingsNearHere')}
          </Text>
        )}
      </View>
    );
  };

  const renderDemand = (data: DemandSnapshot) => {
    const level = LEVELS[data.level];

    return (
      <>
        <View style={styles.card}>
          <View style={styles.levelRow}>
            <View style={[styles.levelDot, { backgroundColor: level.colour }]} />
            <Text style={[styles.levelLabel, { color: level.colour }]}>{t(level.label as TranslationKey)}</Text>
          </View>

          <Text style={styles.cardSubtitle}>
            Within {data.radiusKm} km, next 24 hours
          </Text>

          <Text style={styles.advice}>{t(level.advice as TranslationKey)}</Text>

          {/* The raw counts are shown alongside the verdict so a driver can
              judge it rather than take it on faith. */}
          <View style={styles.figures}>
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{data.seatsTaken}</Text>
              <Text style={styles.figureLabel}>{t('ui.seatsBooked')}</Text>
            </View>
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{data.seatsOffered}</Text>
              <Text style={styles.figureLabel}>{t('ui.seatsOffered')}</Text>
            </View>
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{data.ridesConsidered}</Text>
              <Text style={styles.figureLabel}>rides</Text>
            </View>
          </View>
        </View>

        {renderHourlyPattern(data.hourlyBookings)}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('ui.demandNearYou')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {loading ? (
          <View style={styles.centred}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        ) : locationError ? (
          <View style={styles.centred}>
            <Icon name="location-off" size={48} color="#CCCCCC" />
            <Text style={styles.emptyTitle}>{t('ui.locationUnavailable2')}</Text>
            <Text style={styles.emptyBody}>
              Demand is worked out from where you are. Turn on location access
              and pull down to try again.
            </Text>
          </View>
        ) : !snapshot ? (
          <View style={styles.centred}>
            <Icon name="insights" size={48} color="#CCCCCC" />
            <Text style={styles.emptyTitle}>{t('ui.couldNotLoadDemand')}</Text>
            <Text style={styles.emptyBody}>{t('ui.pullDownToTryAgain')}</Text>
          </View>
        ) : (
          renderDemand(snapshot)
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
  scrollContent: { padding: 16, gap: 16 },
  centred: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 64, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#333333' },
  emptyBody: { fontSize: 14, lineHeight: 20, color: '#777777', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333333' },
  cardSubtitle: { fontSize: 12, color: '#888888' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelLabel: { fontSize: 20, fontWeight: '700' },
  advice: { fontSize: 14, lineHeight: 20, color: '#444444', marginTop: 4 },
  figures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  figure: { alignItems: 'center', flex: 1 },
  figureValue: { fontSize: 20, fontWeight: '700', color: '#333333' },
  figureLabel: { fontSize: 11, color: '#888888', marginTop: 2 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: 2,
    marginTop: 12,
  },
  barColumn: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 2, width: '100%' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { fontSize: 10, color: '#AAAAAA' },
  insight: { fontSize: 13, color: '#444444', marginTop: 8 },
});

export default AIDashboardScreen;
