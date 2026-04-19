/**
 * @fileoverview Simplified Emergency Service for testing
 * @author Oabona-Majoko
 * @created 2025-01-27
 */

import { Alert, Linking } from 'react-native';
import { authApi } from './api/authApi';
import locationService from './LocationService';

export interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  relationship: string;
  isPrimary: boolean;
}

export interface EmergencyAlert {
  id: string;
  userId: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  timestamp: string;
  type: 'panic' | 'medical' | 'accident' | 'harassment' | 'other';
  description?: string;
  status: 'active' | 'resolved' | 'false_alarm';
  rideId?: string;
  emergencyContacts: string[];
}

class EmergencyServiceSimple {
  private static instance: EmergencyServiceSimple;
  private currentAlert: EmergencyAlert | null = null;

  public static getInstance(): EmergencyServiceSimple {
    if (!EmergencyServiceSimple.instance) {
      EmergencyServiceSimple.instance = new EmergencyServiceSimple();
    }
    return EmergencyServiceSimple.instance;
  }

  async triggerEmergency(type: EmergencyAlert['type'] = 'panic', description?: string, rideId?: string): Promise<void> {
    try {
      const pos = await locationService.getCurrentLocation({ timeout: 5000 }).catch(() => null);
      const { apiClient } = await import('./api/baseApi');
      await apiClient.post('/locations/emergency', {
        latitude: pos?.latitude ?? 0,
        longitude: pos?.longitude ?? 0,
        emergencyType: type,
        message: description,
        rideId,
      });
      Alert.alert('Emergency Alert Sent', 'Your emergency alert has been sent. Help is on the way.');
    } catch {
      Alert.alert('Emergency', `Emergency type: ${type}. ${description || ''}\nAlert could not be sent to server.`);
    }
  }

  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    try {
      const response = await authApi.getProfile();
      if (response.success && response.data) {
        const profile = response.data as any;
        if (profile.emergencyContactName && profile.emergencyContactPhone) {
          return [{
            id: `${profile.id}_emergency`,
            name: profile.emergencyContactName,
            phoneNumber: profile.emergencyContactPhone,
            relationship: 'Emergency Contact',
            isPrimary: true,
          }];
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  async callEmergencyServices(): Promise<void> {
    await Linking.openURL('tel:999');
  }

  async callPrimaryContact(): Promise<void> {
    const contacts = await this.getEmergencyContacts();
    const primary = contacts.find((c) => c.isPrimary) || contacts[0];
    if (primary) {
      await Linking.openURL(`tel:${primary.phoneNumber}`);
    } else {
      Alert.alert('No Contact', 'No emergency contact has been set. Please add one in your profile settings.');
    }
  }

  async resolveEmergency(): Promise<void> {
    this.currentAlert = null;
    Alert.alert('Emergency Resolved', 'Emergency has been resolved');
  }

  hasActiveEmergency(): boolean {
    return this.currentAlert !== null;
  }

  getCurrentEmergency(): EmergencyAlert | null {
    return this.currentAlert;
  }
}

export default EmergencyServiceSimple.getInstance();