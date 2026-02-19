/**
 * @fileoverview Trip sharing service for sharing live ride status with contacts
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import { Linking, Platform, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from './LoggingService';

const log = logger.createLogger('TripSharingService');

export interface TripShareData {
  rideId: string;
  driverName: string;
  vehicleInfo?: string;
  origin: string;
  destination: string;
  departureTime?: string;
  estimatedArrival?: string;
  passengerName: string;
  currentLocation?: { latitude: number; longitude: number };
}

export interface SharedTrip {
  rideId: string;
  sharedWith: string[]; // phone numbers
  sharedAt: string;
  active: boolean;
}

const SHARED_TRIPS_KEY = '@aryv_shared_trips';

class TripSharingService {
  private static instance: TripSharingService;
  private activeShares: Map<string, SharedTrip> = new Map();

  static getInstance(): TripSharingService {
    if (!TripSharingService.instance) {
      TripSharingService.instance = new TripSharingService();
    }
    return TripSharingService.instance;
  }

  /**
   * Build the trip sharing message
   */
  buildShareMessage(trip: TripShareData): string {
    const lines = [
      `ARYV Trip Update`,
      ``,
      `${trip.passengerName} is travelling:`,
      `From: ${trip.origin}`,
      `To: ${trip.destination}`,
    ];

    if (trip.driverName) {
      lines.push(`Driver: ${trip.driverName}`);
    }
    if (trip.vehicleInfo) {
      lines.push(`Vehicle: ${trip.vehicleInfo}`);
    }
    if (trip.departureTime) {
      lines.push(`Departure: ${trip.departureTime}`);
    }
    if (trip.estimatedArrival) {
      lines.push(`ETA: ${trip.estimatedArrival}`);
    }
    if (trip.currentLocation) {
      const mapUrl = `https://maps.google.com/?q=${trip.currentLocation.latitude},${trip.currentLocation.longitude}`;
      lines.push(``, `Live Location: ${mapUrl}`);
    }

    lines.push(``, `Shared via ARYV - Safe Intercity Travel`);
    return lines.join('\n');
  }

  /**
   * Share trip via native share sheet (SMS, WhatsApp, etc.)
   */
  async shareTrip(trip: TripShareData): Promise<boolean> {
    try {
      const message = this.buildShareMessage(trip);
      const result = await Share.share({
        message,
        title: 'ARYV Trip Details',
      });

      if (result.action === Share.sharedAction) {
        await this.recordShare(trip.rideId, ['shared']);
        return true;
      }
      return false;
    } catch (error) {
      log.error('Share failed', error);
      return false;
    }
  }

  /**
   * Share trip directly via SMS to a specific number
   */
  async shareTripViaSMS(trip: TripShareData, phoneNumber: string): Promise<boolean> {
    try {
      const message = encodeURIComponent(this.buildShareMessage(trip));
      const smsUrl = Platform.OS === 'ios'
        ? `sms:${phoneNumber}&body=${message}`
        : `sms:${phoneNumber}?body=${message}`;

      const canOpen = await Linking.canOpenURL(smsUrl);
      if (canOpen) {
        await Linking.openURL(smsUrl);
        await this.recordShare(trip.rideId, [phoneNumber]);
        return true;
      }
      return false;
    } catch (error) {
      log.error('SMS share failed', error);
      return false;
    }
  }

  /**
   * Share trip via WhatsApp to a specific number
   */
  async shareTripViaWhatsApp(trip: TripShareData, phoneNumber: string): Promise<boolean> {
    try {
      const message = encodeURIComponent(this.buildShareMessage(trip));
      // Remove leading + and spaces for WhatsApp format
      const cleanNumber = phoneNumber.replace(/[\s+\-]/g, '');
      const waUrl = `whatsapp://send?phone=${cleanNumber}&text=${message}`;

      const canOpen = await Linking.canOpenURL(waUrl);
      if (canOpen) {
        await Linking.openURL(waUrl);
        await this.recordShare(trip.rideId, [phoneNumber]);
        return true;
      }
      // Fallback to web WhatsApp
      const webUrl = `https://wa.me/${cleanNumber}?text=${message}`;
      await Linking.openURL(webUrl);
      await this.recordShare(trip.rideId, [phoneNumber]);
      return true;
    } catch (error) {
      log.error('WhatsApp share failed', error);
      return false;
    }
  }

  /**
   * Share trip with all emergency contacts
   */
  async shareWithEmergencyContacts(trip: TripShareData): Promise<number> {
    try {
      const contactsRaw = await AsyncStorage.getItem('@emergency_contacts');
      if (!contactsRaw) return 0;

      const contacts = JSON.parse(contactsRaw);
      let sharedCount = 0;

      for (const contact of contacts) {
        if (contact.phoneNumber) {
          const success = await this.shareTripViaSMS(trip, contact.phoneNumber);
          if (success) sharedCount++;
        }
      }

      return sharedCount;
    } catch (error) {
      log.error('Emergency contacts share failed', error);
      return 0;
    }
  }

  /**
   * Record that a trip was shared
   */
  private async recordShare(rideId: string, recipients: string[]): Promise<void> {
    try {
      const share: SharedTrip = {
        rideId,
        sharedWith: recipients,
        sharedAt: new Date().toISOString(),
        active: true,
      };

      this.activeShares.set(rideId, share);

      // Persist
      const existing = await AsyncStorage.getItem(SHARED_TRIPS_KEY);
      const shares: SharedTrip[] = existing ? JSON.parse(existing) : [];
      shares.push(share);
      // Keep only last 20 shares
      const trimmed = shares.slice(-20);
      await AsyncStorage.setItem(SHARED_TRIPS_KEY, JSON.stringify(trimmed));
    } catch (error) {
      log.warn('Failed to record share', { error: String(error) });
    }
  }

  /**
   * Check if a trip is currently being shared
   */
  isTripShared(rideId: string): boolean {
    const share = this.activeShares.get(rideId);
    return share?.active || false;
  }

  /**
   * End trip sharing
   */
  endSharing(rideId: string): void {
    const share = this.activeShares.get(rideId);
    if (share) {
      share.active = false;
      this.activeShares.set(rideId, share);
    }
  }

  /**
   * Get emergency contacts for sharing UI
   */
  async getEmergencyContacts(): Promise<Array<{ name: string; phoneNumber: string; isPrimary: boolean }>> {
    try {
      const raw = await AsyncStorage.getItem('@emergency_contacts');
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}

export default TripSharingService;
