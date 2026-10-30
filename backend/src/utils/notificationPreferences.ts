/**
 * @fileoverview A user's notification choices, and which pushes they allow
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * The app's notification settings were switches that saved nothing, and the
 * choices the server did store were never consulted: every push went out
 * regardless. sendToUser now asks pushAllowed before sending a push. The
 * in-app (socket) copy is always delivered; these govern the phone alert.
 * Safety alerts, calls and account security are never switched off.
 */

export const NOTIFICATION_PREFERENCE_KEYS = ['pushNotifications', 'rideUpdates', 'messages', 'payments', 'promotions'] as const;
export type NotificationPreferenceKey = typeof NOTIFICATION_PREFERENCE_KEYS[number];
export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushNotifications: true,
  rideUpdates: true,
  messages: true,
  payments: true,
  promotions: false,
};

/** Stored choices over the defaults; unknown or non-boolean values are ignored. */
export function notificationPreferencesOf(stored: unknown): NotificationPreferences {
  const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  if (stored && typeof stored === 'object') {
    for (const key of NOTIFICATION_PREFERENCE_KEYS) {
      const value = (stored as Record<string, unknown>)[key];
      if (typeof value === 'boolean') {prefs[key] = value;}
    }
  }
  return prefs;
}

/** Which choice governs a notification type; null means always sent. */
export function categoryOf(type: string): Exclude<NotificationPreferenceKey, 'pushNotifications'> | null {
  if (/^(emergency|incoming_call|call_|security|account_)/.test(type)) {return null;}
  if (/^(chat|message|group_chat)/.test(type)) {return 'messages';}
  if (/^(cash_|payment|escrow|commission|rider_confirmation|wallet)/.test(type)) {return 'payments';}
  if (/^(promo|offer|marketing)/.test(type)) {return 'promotions';}
  return 'rideUpdates';
}

/** Whether this user's choices allow a push of this type. */
export function pushAllowed(stored: unknown, type: string): boolean {
  const category = categoryOf(type);
  if (category === null) {return true;}
  const prefs = notificationPreferencesOf(stored);
  return prefs.pushNotifications && prefs[category];
}
