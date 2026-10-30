/**
 * @fileoverview App-wide navigation, and where each notification opens
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Tapping a notification used to open nothing: every handler was an empty
 * stub. openFromNotification maps the notification's type and ids to a
 * screen. A tap that arrives before the signed-in screens exist (the app
 * opened from a push, still starting up) is held and run once they do.
 */

import { createNavigationContainerRef } from '@react-navigation/native';
import logger from './LoggingService';

const log = logger.createLogger('appNavigation');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const navigationRef = createNavigationContainerRef<any>();

type Target = { name: string; params?: Record<string, unknown> };
let pending: Target | null = null;

const signedIn = (): boolean =>
  navigationRef.isReady() && !!navigationRef.getRootState()?.routeNames?.includes('MainTab');

const tab = (screen: string, params?: Record<string, unknown>): Target =>
  ({ name: 'MainTab', params: params ? { screen, params } : { screen } });

const inStack = (tabName: string, screen: string, params?: Record<string, unknown>): Target =>
  tab(tabName, { screen, params });

/** Navigate now if the signed-in screens are up, otherwise as soon as they are. */
function go(target: Target): void {
  if (signedIn()) {
    navigationRef.navigate(target.name, target.params);
  } else {
    pending = target;
  }
}

/** Called by the navigation container when it is ready or its state changes. */
export function flushPendingNavigation(): void {
  if (pending && signedIn()) {
    const target = pending;
    pending = null;
    navigationRef.navigate(target.name, target.params);
  }
}

const str = (v: unknown): string | undefined => (v == null || v === '' ? undefined : String(v));

/** Where a notification of this type leads. Exported for tests. */
export function targetFor(type: string, data: Record<string, unknown> = {}): Target | null {
  const rideId = str(data['rideId']);
  const ride = rideId ? inStack('Home', 'RideDetails', { rideId }) : tab('Rides');

  switch (type) {
    // A ride or a booking on one: open the ride.
    case 'ride_request_match':
    case 'ride_status_change':
    case 'ride_matched':
    case 'ride_started':
    case 'ride_completed':
    case 'driver_arrived':
    case 'booking_status_change':
    case 'booking_update':
    case 'new_booking_request':
    case 'booking_rated':
      return ride;

    // Cash payments belong to a ride the person can find in My Rides.
    case 'cash_payment_created':
    case 'cash_payment_expected':
    case 'rider_confirmation_needed':
    case 'cash_dispute_resolved':
    case 'payment_received':
      return tab('Rides');

    // Packages.
    case 'delivery_update':
    case 'delivery_dispute_raised':
    case 'delivery_dispute_resolved':
    case 'escrow_release':
    case 'agreement_created':
      return tab('Courier');

    case 'chat_message':
      return tab('Messages');

    case 'emergency_alert':
    case 'emergency_alert_ack':
      return tab('Home');

    // Calls open their own screen through CallIntegrationService.
    case 'incoming_call':
    case 'call_status_update':
      return null;

    default:
      return inStack('Profile', 'NotificationsInbox');
  }
}

/** Open the screen a tapped notification is about. */
export function openFromNotification(type: string | undefined, data?: Record<string, unknown>): void {
  const target = targetFor(type ?? '', data ?? {});
  log.info('Opening notification', { type, target: target?.name });
  if (target) {go(target);}
}
