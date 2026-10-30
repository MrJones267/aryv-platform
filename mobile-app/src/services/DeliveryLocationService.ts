/**
 * @fileoverview Keeps sharing the courier's position while the app is in the background
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Android only. Runs a foreground service of type "location" (an ongoing
 * "Sharing your location" notification) so positions keep reaching the
 * sender while the courier uses another app for directions or locks the
 * phone. It is started from the delivery screen, while the app is in front,
 * which is what lets Android keep "while in use" location access without
 * asking for background location.
 *
 * It sends for every delivery the courier has in transit, drops one when
 * the server says it is no longer in transit (delivered, cancelled, or
 * disputed), and stops itself when none are left, or after MAX_RUN_MS.
 */

import { PermissionsAndroid, Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import Geolocation from '@react-native-community/geolocation';
import PackageService from './PackageService';
import logger from './LoggingService';

const log = logger.createLogger('DeliveryLocationService');

// Constants
const CONSTANTS = {
  SEND_INTERVAL_MS: 20000,
  DISTANCE_FILTER_M: 25,
  CHECK_INTERVAL_MS: 5000,
  // A safety stop, in case a delivery is never closed.
  MAX_RUN_MS: 8 * 60 * 60 * 1000,
};

export type SharingState = 'off' | 'starting' | 'sharing' | 'no_permission' | 'unavailable';

const agreements = new Set<string>();
const listeners = new Set<(state: SharingState) => void>();
let state: SharingState = 'off';
let lastSent = 0;

function setState(next: SharingState): void {
  state = next;
  listeners.forEach(listener => listener(next));
}

async function send(longitude: number, latitude: number, coords: { accuracy?: number | null; speed?: number | null; heading?: number | null }) {
  await Promise.all([...agreements].map(async agreementId => {
    const result = await PackageService.updateCourierLocation(
      agreementId,
      [longitude, latitude],
      coords.accuracy ?? undefined,
      coords.speed != null && coords.speed >= 0 ? coords.speed : undefined,
      coords.heading != null && coords.heading >= 0 ? coords.heading : undefined,
    );
    // 404: the delivery is no longer in transit, so stop sending for it.
    if (!result.success && /HTTP 404/.test(result.error || '')) {
      agreements.delete(agreementId);
    }
  }));
}

/** The service's task: watch the position until nothing is left to share. */
async function run(): Promise<void> {
  const startedAt = Date.now();
  await new Promise<void>(resolve => {
    const watchId = Geolocation.watchPosition(
      position => {
        setState('sharing');
        const now = Date.now();
        if (now - lastSent < CONSTANTS.SEND_INTERVAL_MS) {return;}
        lastSent = now;
        const { longitude, latitude, accuracy, speed, heading } = position.coords;
        send(longitude, latitude, { accuracy, speed, heading })
          .catch(error => log.warn('Could not send delivery location', error));
      },
      error => {
        log.warn('Location unavailable during delivery', error);
        setState('unavailable');
      },
      { enableHighAccuracy: true, distanceFilter: CONSTANTS.DISTANCE_FILTER_M, maximumAge: 10000, timeout: 20000 },
    );
    const check = setInterval(() => {
      if (agreements.size === 0 || Date.now() - startedAt > CONSTANTS.MAX_RUN_MS) {
        clearInterval(check);
        Geolocation.clearWatch(watchId);
        resolve();
      }
    }, CONSTANTS.CHECK_INTERVAL_MS);
  });
  agreements.clear();
  setState('off');
  await BackgroundService.stop();
}

async function hasPermission(): Promise<boolean> {
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
    title: 'Share your location',
    message: 'ARYV shares your location with the sender while you deliver their package, so they can see it on the way, even when you switch to another app.',
    buttonNegative: 'Not now',
    buttonPositive: 'OK',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export const DeliveryLocationService = {
  /** Whether this platform can share in the background. */
  supported: Platform.OS === 'android',

  getState(): SharingState {
    return state;
  },

  subscribe(listener: (next: SharingState) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Start (or join) sharing for a delivery in transit. Call while the app is in front. */
  async start(agreementId: string): Promise<SharingState> {
    if (agreements.has(agreementId) && BackgroundService.isRunning()) {
      return state;
    }
    if (!(await hasPermission())) {
      setState('no_permission');
      return state;
    }
    agreements.add(agreementId);
    if (BackgroundService.isRunning()) {
      return state;
    }
    setState('starting');
    lastSent = 0;
    try {
      await BackgroundService.start(run, {
        taskName: 'DeliveryLocation',
        taskTitle: 'Sharing your location',
        taskDesc: 'The sender can follow their package until you hand it over.',
        taskIcon: { name: 'ic_launcher', type: 'mipmap' },
        foregroundServiceType: ['location'],
      });
    } catch (error) {
      log.error('Could not start background location sharing', error);
      agreements.delete(agreementId);
      setState('unavailable');
    }
    return state;
  },

  /** Stop sharing for a delivery, e.g. when it is no longer in transit. */
  stop(agreementId: string): void {
    agreements.delete(agreementId);
  },
};

export default DeliveryLocationService;
