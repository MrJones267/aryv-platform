/**
 * @fileoverview Simplified Emergency Service for testing
 * @author Oabona-Majoko
 * @created 2025-01-27
 */

import { Alert } from 'react-native';

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

  async triggerEmergency(type: EmergencyAlert['type'] = 'panic', description?: string): Promise<void> {
    Alert.alert('Emergency Triggered', `Emergency type: ${type}. ${description || 'No description'}`);
  }

  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    return [];
  }

  async callEmergencyServices(): Promise<void> {
    Alert.alert('Emergency Services', 'Calling 911...');
  }

  async callPrimaryContact(): Promise<void> {
    Alert.alert('Emergency Contact', 'Calling emergency contact...');
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