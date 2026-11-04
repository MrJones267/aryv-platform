/**
 * @fileoverview Where the phone is, without timing out indoors.
 * @author Oabona-Majoko
 * @created 2026-11-04
 * @lastModified 2026-11-04
 *
 * Location requests timed out. The geolocation library used Android's plain
 * LocationManager, which with enableHighAccuracy waits for a GPS fix, and a
 * GPS fix indoors often takes longer than the 15 seconds allowed. There was
 * no second try, so the request failed outright.
 *
 * Google's fused provider answers from Wi-Fi and cell towers as well as GPS,
 * and when a precise fix does not come in time a quick, coarser one is taken
 * instead: enough to centre the map and fill in a pickup point.
 */

import Geolocation, { GeolocationResponse } from '@react-native-community/geolocation';

Geolocation.setRNConfiguration({
  // Permissions are asked for by the onboarding screen, not by every request.
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
  locationProvider: 'playServices',
  // The library's default is true; only delivery sharing runs in the
  // background, through its own foreground service.
  enableBackgroundLocationUpdates: false,
});

/** Codes from the Geolocation API. */
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

const attempt = (options: { enableHighAccuracy: boolean; timeout: number; maximumAge: number }): Promise<GeolocationResponse> =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, options);
  });

/**
 * The phone's position: a precise fix if one comes within 15 seconds,
 * otherwise a quick coarse one (Wi-Fi and cell towers, or a recent fix).
 * Rejects only when there is no position at all, or permission is denied.
 */
export async function getPosition(): Promise<GeolocationResponse> {
  try {
    return await attempt({ enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code !== TIMEOUT && code !== POSITION_UNAVAILABLE) throw error;
    return attempt({ enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 });
  }
}

export default getPosition;
