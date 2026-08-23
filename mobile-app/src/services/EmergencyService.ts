/**
 * @fileoverview Raising and tracking an emergency from the app.
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2026-08-23
 *
 * This replaces two services that disagreed with each other and with the
 * server. The one the screens actually imported posted to `/locations/emergency`
 * — the route is `/locations/emergency-alert` — so every SOS 404'd, and the
 * failure was caught and shown as a mild notice while the user believed help
 * was coming. The other, longer one called `/user/emergency-contacts` and
 * `/emergency/alerts`, neither of which existed at all.
 *
 * Two rules run through what follows.
 *
 * Never claim help is coming unless somebody was actually reached. The server
 * reports how many contacts it got through to, and that number is shown as-is.
 *
 * 999 always works, and is offered on every failure path. When the network is
 * gone, the app cannot raise anything — dialling is the only thing left, so it
 * is put in front of the user rather than buried behind a retry.
 */

import { Alert, Linking } from 'react-native';
import { apiClient } from './api/baseApi';
import locationService from './LocationService';
import logger from './LoggingService';

const log = logger.createLogger('EmergencyService');

/** Botswana's emergency number. Offered whenever we cannot reach anyone. */
export const EMERGENCY_NUMBER = '999';

/** How often an open alert reports its position while the user moves. */
const LOCATION_PING_MS = 15000;

export type EmergencyAlertType =
  | 'panic'
  | 'harassment'
  | 'accident'
  | 'medical'
  | 'breakdown'
  | 'safety'
  | 'other';

export type EmergencyAlertStatus = 'raised' | 'acknowledged' | 'resolved' | 'false_alarm';

export interface EmergencyContact {
  id: string;
  name: string;
  /** E.164, as stored by the server. */
  phone: string;
  relationship?: string | null;
  isPrimary: boolean;
}

export interface EmergencyAlert {
  id: string;
  alertType: EmergencyAlertType;
  status: EmergencyAlertStatus;
  message?: string | null;
  raisedLocation: { latitude: number; longitude: number } | null;
  lastLocation: { latitude: number; longitude: number } | null;
  rideId?: string | null;
  /** How many contacts the server actually reached. Zero is meaningful. */
  contactsNotified: number;
  createdAt: string;
}

export interface RaiseResult {
  ok: boolean;
  alert: EmergencyAlert | null;
  /** What to tell the user. Written by the server so the two never disagree. */
  guidance: string;
}

class EmergencyService {
  private static instance: EmergencyService;

  private activeAlert: EmergencyAlert | null = null;
  private locationTimer: ReturnType<typeof setInterval> | null = null;

  static getInstance(): EmergencyService {
    if (!EmergencyService.instance) {
      EmergencyService.instance = new EmergencyService();
    }
    return EmergencyService.instance;
  }

  /**
   * Raise an alert.
   *
   * The location is fetched first but never allowed to block: a fix can take
   * many seconds indoors, and an alert with no coordinates still reaches the
   * user's contacts, which is most of the value. If the request itself fails
   * the user is offered the dialler, because at that point nothing else works.
   */
  async triggerEmergency(
    alertType: EmergencyAlertType = 'panic',
    message?: string,
    rideId?: string,
  ): Promise<RaiseResult> {
    const coordinates = await this.getCoordinates();

    if (!coordinates) {
      // Without a position there is nothing useful to send responders, and
      // the server requires one. Go straight to the thing that works.
      this.offerDialler(
        'We could not get your location',
        `Call ${EMERGENCY_NUMBER} to reach emergency services directly.`,
      );

      return {
        ok: false,
        alert: null,
        guidance: `Location unavailable. Call ${EMERGENCY_NUMBER}.`,
      };
    }

    try {
      const response = await apiClient.post('/emergency/alerts', {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        alertType,
        message,
        rideId,
      });

      const data = response.data?.data;

      if (!data?.id) {
        throw new Error('Alert was not created');
      }

      this.activeAlert = data as EmergencyAlert;
      this.startLocationUpdates();

      // The server's own words, which state whether anyone was reached rather
      // than assuming they were.
      const guidance: string = data.guidance
        ?? `Alert raised. If you are in immediate danger, call ${EMERGENCY_NUMBER}.`;

      if (this.activeAlert.contactsNotified > 0) {
        Alert.alert('Emergency alert sent', guidance, [
          { text: `Call ${EMERGENCY_NUMBER}`, onPress: () => this.callEmergencyServices() },
          { text: 'OK', style: 'cancel' },
        ]);
      } else {
        // Nobody was reached. This is not a success message.
        this.offerDialler('Nobody could be reached', guidance);
      }

      return { ok: true, alert: this.activeAlert, guidance };
    } catch (error) {
      log.error('Failed to raise emergency alert', { error: String(error) });

      this.offerDialler(
        'Your alert could not be sent',
        `We could not reach ARYV. Call ${EMERGENCY_NUMBER} now if you are in danger.`,
      );

      return {
        ok: false,
        alert: null,
        guidance: `Alert could not be sent. Call ${EMERGENCY_NUMBER}.`,
      };
    }
  }

  /**
   * Report the user's position while an alert is open, so responders follow
   * them rather than going to where they were when they pressed the button.
   * Failures are silent by design — a dropped ping is not worth a dialog on a
   * screen someone is using in an emergency.
   */
  private startLocationUpdates(): void {
    this.stopLocationUpdates();

    this.locationTimer = setInterval(async () => {
      const alert = this.activeAlert;

      if (!alert) {
        this.stopLocationUpdates();
        return;
      }

      const coordinates = await this.getCoordinates();

      if (!coordinates) {
        return;
      }

      try {
        await apiClient.put(`/emergency/alerts/${alert.id}/location`, coordinates);
      } catch (error) {
        log.warn('Emergency location update failed', { error: String(error) });
      }
    }, LOCATION_PING_MS);
  }

  private stopLocationUpdates(): void {
    if (this.locationTimer) {
      clearInterval(this.locationTimer);
      this.locationTimer = null;
    }
  }

  /** Stand the alert down. Local state clears even if the server call fails. */
  async resolveEmergency(options: { falseAlarm?: boolean; note?: string } = {}): Promise<boolean> {
    const alert = this.activeAlert;
    this.stopLocationUpdates();

    if (!alert) {
      return true;
    }

    try {
      await apiClient.put(`/emergency/alerts/${alert.id}/resolve`, {
        falseAlarm: Boolean(options.falseAlarm),
        note: options.note,
      });

      this.activeAlert = null;
      return true;
    } catch (error) {
      log.error('Failed to resolve emergency alert', { error: String(error) });

      // Clear locally regardless: leaving the UI stuck in an emergency the
      // user has ended is its own problem, and the server keeps the record.
      this.activeAlert = null;
      return false;
    }
  }

  /**
   * Re-read any open alert from the server.
   *
   * Called on startup so an alert raised before the app was killed is still
   * shown as open, rather than silently forgotten with its location updates
   * stopped.
   */
  async refreshActiveAlert(): Promise<EmergencyAlert | null> {
    try {
      const response = await apiClient.get('/emergency/alerts/active');
      this.activeAlert = (response.data?.data as EmergencyAlert) ?? null;

      if (this.activeAlert) {
        this.startLocationUpdates();
      }

      return this.activeAlert;
    } catch (error) {
      log.warn('Could not load active emergency alert', { error: String(error) });
      return null;
    }
  }

  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    try {
      const response = await apiClient.get('/emergency/contacts');
      return (response.data?.data as EmergencyContact[]) ?? [];
    } catch (error) {
      log.error('Failed to load emergency contacts', { error: String(error) });
      return [];
    }
  }

  async addEmergencyContact(input: {
    name: string;
    phone: string;
    relationship?: string;
    isPrimary?: boolean;
  }): Promise<{ ok: boolean; contact: EmergencyContact | null; error?: string }> {
    try {
      const response = await apiClient.post('/emergency/contacts', input);
      return { ok: true, contact: (response.data?.data as EmergencyContact) ?? null };
    } catch (error: any) {
      // The server explains an unreadable phone number precisely; pass that
      // through rather than replacing it with something vaguer.
      const message = error?.response?.data?.error ?? 'Could not save the contact';
      log.error('Failed to add emergency contact', { error: String(error) });
      return { ok: false, contact: null, error: message };
    }
  }

  async updateEmergencyContact(
    id: string,
    updates: { name?: string; phone?: string; relationship?: string; isPrimary?: boolean },
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      await apiClient.put(`/emergency/contacts/${id}`, updates);
      return { ok: true };
    } catch (error: any) {
      const message = error?.response?.data?.error ?? 'Could not update the contact';
      log.error('Failed to update emergency contact', { error: String(error) });
      return { ok: false, error: message };
    }
  }

  async removeEmergencyContact(id: string): Promise<boolean> {
    try {
      await apiClient.delete(`/emergency/contacts/${id}`);
      return true;
    } catch (error) {
      log.error('Failed to remove emergency contact', { error: String(error) });
      return false;
    }
  }

  /** Dial 999. Works with no network and no account. */
  async callEmergencyServices(): Promise<void> {
    await Linking.openURL(`tel:${EMERGENCY_NUMBER}`);
  }

  /** Dial whoever the user marked primary, or say plainly that nobody is set. */
  async callPrimaryContact(): Promise<void> {
    const contacts = await this.getEmergencyContacts();
    const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];

    if (!primary) {
      this.offerDialler(
        'No emergency contact set',
        `You have not added an emergency contact yet. You can still call ${EMERGENCY_NUMBER}.`,
      );
      return;
    }

    await Linking.openURL(`tel:${primary.phone}`);
  }

  hasActiveEmergency(): boolean {
    return this.activeAlert !== null;
  }

  getCurrentEmergency(): EmergencyAlert | null {
    return this.activeAlert;
  }

  /**
   * A position, or null.
   *
   * Bounded so a slow fix cannot hold up an emergency: five seconds, then
   * proceed without it rather than leaving someone staring at a spinner.
   */
  private async getCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const position = await locationService.getCurrentLocation({ timeout: 5000 });

      if (!position || !Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) {
        return null;
      }

      return { latitude: position.latitude, longitude: position.longitude };
    } catch (error) {
      log.warn('Could not get a location for the emergency alert', { error: String(error) });
      return null;
    }
  }

  /** Every failure path ends with the dialler in front of the user. */
  private offerDialler(title: string, body: string): void {
    Alert.alert(title, body, [
      { text: `Call ${EMERGENCY_NUMBER}`, onPress: () => this.callEmergencyServices() },
      { text: 'Close', style: 'cancel' },
    ]);
  }
}

export default EmergencyService.getInstance();
