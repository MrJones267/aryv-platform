/**
 * @fileoverview Shares the courier's position with the sender during a delivery
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * While a delivery is in transit, the phone's position is sent to the server
 * about every 20 seconds so the sender's tracking map can show where the
 * package is.
 *
 * On Android it keeps going in the background (DeliveryLocationService runs
 * a foreground service with an ongoing notification) until the delivery is
 * no longer in transit. Elsewhere it shares only while this screen is open.
 */

import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import PackageService from '../services/PackageService';
import DeliveryLocationService, { SharingState } from '../services/DeliveryLocationService';
import logger from '../services/LoggingService';

const log = logger.createLogger('useShareDeliveryLocation');

const CONSTANTS = {
  SEND_INTERVAL_MS: 20000,
  DISTANCE_FILTER_M: 25,
};

export type LocationSharingState = SharingState;

async function hasPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {return true;}
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
    title: 'Share your location',
    message: 'ARYV shares your location with the sender while you deliver their package, so they can see it on the way.',
    buttonNegative: 'Not now',
    buttonPositive: 'OK',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

/** Android: background sharing through the foreground service. */
function useBackgroundSharing(agreementId: string | undefined, active: boolean): LocationSharingState {
  const [state, setState] = useState<LocationSharingState>(DeliveryLocationService.getState());

  useEffect(() => DeliveryLocationService.subscribe(setState), []);

  useEffect(() => {
    if (!agreementId) {return;}
    if (active) {
      DeliveryLocationService.start(agreementId).then(setState).catch(error => log.warn('Could not share location', error));
    } else {
      // Delivered, cancelled or disputed: stop sending for this one. Leaving
      // the screen does not stop it; that is the point.
      DeliveryLocationService.stop(agreementId);
    }
  }, [agreementId, active]);

  return active ? state : 'off';
}

/** Elsewhere: share only while the screen is open. */
function useForegroundSharing(agreementId: string | undefined, active: boolean): LocationSharingState {
  const [state, setState] = useState<LocationSharingState>('off');
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!agreementId || !active) {
      setState('off');
      return undefined;
    }

    let watchId: number | null = null;
    let cancelled = false;

    (async () => {
      if (!(await hasPermission())) {
        if (!cancelled) {setState('no_permission');}
        return;
      }
      if (cancelled) {return;}

      watchId = Geolocation.watchPosition(
        position => {
          setState('sharing');
          const now = Date.now();
          if (now - lastSentRef.current < CONSTANTS.SEND_INTERVAL_MS) {return;}
          lastSentRef.current = now;
          const { longitude, latitude, accuracy, speed, heading } = position.coords;
          PackageService.updateCourierLocation(
            agreementId,
            [longitude, latitude],
            accuracy ?? undefined,
            speed != null && speed >= 0 ? speed : undefined,
            heading != null && heading >= 0 ? heading : undefined,
          ).catch(error => log.warn('Could not send delivery location', error));
        },
        error => {
          log.warn('Location unavailable during delivery', error);
          setState('unavailable');
        },
        { enableHighAccuracy: true, distanceFilter: CONSTANTS.DISTANCE_FILTER_M, maximumAge: 10000, timeout: 20000 },
      );
    })();

    return () => {
      cancelled = true;
      if (watchId !== null) {Geolocation.clearWatch(watchId);}
    };
  }, [agreementId, active]);

  return state;
}

export const useShareDeliveryLocation = DeliveryLocationService.supported ? useBackgroundSharing : useForegroundSharing;

export default useShareDeliveryLocation;
