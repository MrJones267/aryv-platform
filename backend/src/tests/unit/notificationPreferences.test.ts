/**
 * @fileoverview Which pushes a person's notification settings allow
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 */

import { pushAllowed, notificationPreferencesOf, categoryOf } from '../../utils/notificationPreferences';

describe('notification preferences', () => {
  it('defaults to everything on except promotions', () => {
    expect(notificationPreferencesOf(undefined)).toEqual({
      pushNotifications: true, rideUpdates: true, messages: true, payments: true, promotions: false,
    });
  });

  it('ignores unknown keys and non-boolean values', () => {
    expect(notificationPreferencesOf({ rideUpdates: 'no', evil: true, messages: false })).toMatchObject({ rideUpdates: true, messages: false });
    expect(notificationPreferencesOf({ evil: true })).not.toHaveProperty('evil');
  });

  it('files each notification under the switch that governs it', () => {
    expect(categoryOf('ride_request_match')).toBe('rideUpdates');
    expect(categoryOf('booking_status_change')).toBe('rideUpdates');
    expect(categoryOf('chat_message')).toBe('messages');
    expect(categoryOf('cash_payment_created')).toBe('payments');
    expect(categoryOf('promo_offer')).toBe('promotions');
    expect(categoryOf('emergency_alert')).toBeNull();
    expect(categoryOf('incoming_call')).toBeNull();
  });

  it('follows the person\'s switches, with the master switch over all', () => {
    expect(pushAllowed({ rideUpdates: false }, 'ride_request_match')).toBe(false);
    expect(pushAllowed({ rideUpdates: false }, 'chat_message')).toBe(true);
    expect(pushAllowed({ pushNotifications: false }, 'chat_message')).toBe(false);
    expect(pushAllowed(undefined, 'promo_offer')).toBe(false);
  });

  it('never silences safety alerts or calls', () => {
    expect(pushAllowed({ pushNotifications: false }, 'emergency_alert')).toBe(true);
    expect(pushAllowed({ pushNotifications: false }, 'incoming_call')).toBe(true);
  });
});
