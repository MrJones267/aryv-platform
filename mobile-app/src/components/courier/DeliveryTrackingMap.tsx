/**
 * @fileoverview Map of a delivery: pickup, drop-off, and where the courier is
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Replaces a placeholder that drew the words "Live Tracking Map" and never
 * showed a map. Points arrive as [lng, lat] from the tracking endpoint.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';

// Constants
const CONSTANTS = {
  MAP_HEIGHT: 260,
  EDGE_PADDING: { top: 48, right: 48, bottom: 48, left: 48 },
  // A courier position older than this is shown as "last seen".
  STALE_AFTER_MS: 5 * 60 * 1000,
};

type LngLat = [number, number];

export interface DeliveryTrackingMapProps {
  pickup?: LngLat | null;
  dropoff?: LngLat | null;
  courierTrail?: Array<{ location: LngLat; timestamp: string }>;
  inTransit: boolean;
}

const toLatLng = ([longitude, latitude]: LngLat) => ({ latitude, longitude });

const DeliveryTrackingMap: React.FC<DeliveryTrackingMapProps> = ({ pickup, dropoff, courierTrail = [], inTransit }) => {
  const mapRef = useRef<MapView>(null);
  const trail = useMemo(() => courierTrail.map(p => toLatLng(p.location)), [courierTrail]);
  const latest = courierTrail.length > 0 ? courierTrail[courierTrail.length - 1] : undefined;
  const stale = latest ? Date.now() - new Date(latest.timestamp).getTime() > CONSTANTS.STALE_AFTER_MS : false;

  const points = useMemo(() => {
    const all = [...trail];
    if (pickup) {all.push(toLatLng(pickup));}
    if (dropoff) {all.push(toLatLng(dropoff));}
    return all;
  }, [trail, pickup, dropoff]);

  // Keep everything in view as the courier moves.
  useEffect(() => {
    if (points.length > 1) {
      mapRef.current?.fitToCoordinates(points, { edgePadding: CONSTANTS.EDGE_PADDING, animated: true });
    }
  }, [points]);

  if (points.length === 0) {
    return (
      <View style={[styles.container, styles.empty]}>
        <Icon name="map" size={48} color={colors.text.secondary} />
        <Text style={styles.emptyText}>The map is not available for this delivery.</Text>
      </View>
    );
  }

  const first = points[0]!;
  let caption: string | null = null;
  if (inTransit && !latest) {caption = 'Waiting for the courier\'s location…';}
  else if (inTransit && latest && stale) {
    caption = `Courier last seen at ${new Date(latest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...first, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        onMapReady={() => {
          if (points.length > 1) {
            mapRef.current?.fitToCoordinates(points, { edgePadding: CONSTANTS.EDGE_PADDING, animated: false });
          }
        }}
      >
        {pickup && <Marker coordinate={toLatLng(pickup)} title="Pickup" pinColor={colors.primary} />}
        {dropoff && <Marker coordinate={toLatLng(dropoff)} title="Drop-off" pinColor={colors.success} />}
        {trail.length > 1 && <Polyline coordinates={trail} strokeColor={colors.primary} strokeWidth={4} />}
        {latest && (
          <Marker coordinate={toLatLng(latest.location)} title="Courier" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.courierDot, stale && styles.courierDotStale]}>
              <Icon name="local-shipping" size={16} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>
      {caption && (
        <View style={styles.caption}>
          <Text style={styles.captionText}>{caption}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: CONSTANTS.MAP_HEIGHT,
    backgroundColor: colors.background.secondary,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  courierDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  courierDotStale: {
    backgroundColor: colors.text.secondary,
  },
  caption: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  captionText: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
  },
});

export default DeliveryTrackingMap;
