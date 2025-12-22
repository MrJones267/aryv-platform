/**
 * @fileoverview Emergency services for safety features
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import { Linking, Alert, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './api';

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

export interface EmergencyLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  timestamp: string;
}

class EmergencyService {
  private static instance: EmergencyService;
  private currentAlert: EmergencyAlert | null = null;
  private locationWatchId: number | null = null;

  public static getInstance(): EmergencyService {
    if (!EmergencyService.instance) {
      EmergencyService.instance = new EmergencyService();
    }
    return EmergencyService.instance;
  }

  /**
   * Trigger emergency alert with location sharing
   */
  async triggerEmergency(type: EmergencyAlert['type'] = 'panic', description?: string): Promise<void> {
    try {
      // Get current location
      const location = await this.getCurrentLocation();
      
      // Get user's emergency contacts
      const contacts = await this.getEmergencyContacts();
      
      if (contacts.length === 0) {
        Alert.alert(
          'No Emergency Contacts',
          'Please add emergency contacts in your profile before using this feature.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Contacts', onPress: () => this.navigateToEmergencySettings() }
          ]
        );
        return;
      }

      // Create emergency alert
      const alert: EmergencyAlert = {
        id: Date.now().toString(),
        userId: await this.getCurrentUserId(),
        location,
        timestamp: new Date().toISOString(),
        type,
        description,
        status: 'active',
        emergencyContacts: contacts.map(c => c.id),
      };

      this.currentAlert = alert;

      // Send alert to server
      await this.sendEmergencyAlert(alert);

      // Start location tracking
      this.startLocationTracking(alert.id);

      // Notify emergency contacts
      await this.notifyEmergencyContacts(alert, contacts);

      // Show emergency interface
      this.showEmergencyInterface(alert);

    } catch (error) {
      console.error('Emergency trigger failed:', error);
      Alert.alert('Emergency Alert Failed', 'Unable to send emergency alert. Please call emergency services directly.');
    }
  }

  /**
   * Get current GPS location
   */
  private getCurrentLocation(): Promise<EmergencyLocation> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
          });
        },
        (error) => {
          console.error('Location error:', error);
          reject(new Error('Unable to get location'));
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000, 
          maximumAge: 60000 
        }
      );
    });
  }

  /**
   * Start continuous location tracking during emergency
   */
  private startLocationTracking(alertId: string): void {
    this.locationWatchId = Geolocation.watchPosition(
      (position) => {
        const location: EmergencyLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        };
        
        // Send location update to server
        this.updateEmergencyLocation(alertId, location);
      },
      (error) => console.error('Location tracking error:', error),
      { 
        enableHighAccuracy: true, 
        distanceFilter: 10, // Update every 10 meters
        interval: 30000 // Update every 30 seconds
      }
    );
  }

  /**
   * Stop location tracking
   */
  private stopLocationTracking(): void {
    if (this.locationWatchId !== null) {
      Geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
  }

  /**
   * Get user's emergency contacts
   */
  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    try {
      const stored = await AsyncStorage.getItem('@emergency_contacts');
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Try to get from server
      try {
        const response = await apiClient.get('/user/emergency-contacts');
        if (response.data) {
          await AsyncStorage.setItem('@emergency_contacts', JSON.stringify(response.data));
          return response.data;
        }
      } catch (serverError) {
        console.warn('Server request failed, using local data only:', serverError);
      }
      
      return [];
    } catch (error) {
      console.error('Error getting emergency contacts:', error);
      return [];
    }
  }

  /**
   * Add emergency contact
   */
  async addEmergencyContact(contact: Omit<EmergencyContact, 'id'>): Promise<void> {
    try {
      const newContact: EmergencyContact = {
        ...contact,
        id: Date.now().toString(),
      };
      
      const contacts = await this.getEmergencyContacts();
      const updatedContacts = [...contacts, newContact];
      
      await AsyncStorage.setItem('@emergency_contacts', JSON.stringify(updatedContacts));
      
      // Sync with server (optional - don't fail if server is down)
      try {
        await apiClient.post('/user/emergency-contacts', newContact);
      } catch (serverError) {
        console.warn('Failed to sync contact with server:', serverError);
      }
    } catch (error) {
      console.error('Error adding emergency contact:', error);
      throw error;
    }
  }

  /**
   * Remove emergency contact
   */
  async removeEmergencyContact(contactId: string): Promise<void> {
    try {
      const contacts = await this.getEmergencyContacts();
      const updatedContacts = contacts.filter(c => c.id !== contactId);
      
      await AsyncStorage.setItem('@emergency_contacts', JSON.stringify(updatedContacts));
      
      // Sync with server (optional)
      try {
        await apiClient.delete(`/user/emergency-contacts/${contactId}`);
      } catch (serverError) {
        console.warn('Failed to remove contact from server:', serverError);
      }
    } catch (error) {
      console.error('Error removing emergency contact:', error);
      throw error;
    }
  }

  /**
   * Call emergency services (911, local emergency number)
   */
  async callEmergencyServices(): Promise<void> {
    const emergencyNumber = this.getLocalEmergencyNumber();
    
    Alert.alert(
      'Call Emergency Services',
      `This will call ${emergencyNumber}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call', 
          style: 'destructive',
          onPress: () => {
            Linking.openURL(`tel:${emergencyNumber}`);
          }
        }
      ]
    );
  }

  /**
   * Get local emergency number based on region
   */
  private getLocalEmergencyNumber(): string {
    // In a real app, this would be determined by device locale/location
    // For now, defaulting to US emergency number
    return '911';
  }

  /**
   * Call primary emergency contact
   */
  async callPrimaryContact(): Promise<void> {
    try {
      const contacts = await this.getEmergencyContacts();
      const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];
      
      if (!primaryContact) {
        Alert.alert('No Emergency Contact', 'Please add emergency contacts first.');
        return;
      }

      Alert.alert(
        'Call Emergency Contact',
        `Call ${primaryContact.name} at ${primaryContact.phoneNumber}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Call', 
            onPress: () => {
              Linking.openURL(`tel:${primaryContact.phoneNumber}`);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error calling primary contact:', error);
      Alert.alert('Error', 'Unable to call emergency contact.');
    }
  }

  /**
   * Send SMS to emergency contacts
   */
  private async notifyEmergencyContacts(alert: EmergencyAlert, contacts: EmergencyContact[]): Promise<void> {
    try {
      const message = `EMERGENCY ALERT from Hitch App: ${alert.type.toUpperCase()} at ${alert.location.latitude}, ${alert.location.longitude}. Time: ${new Date(alert.timestamp).toLocaleString()}. ${alert.description || ''}`;
      
      for (const contact of contacts) {
        try {
          // In a real app, this would use a service like Twilio to send SMS
          // For now, we'll use the device's SMS app
          const smsUrl = `sms:${contact.phoneNumber}?body=${encodeURIComponent(message)}`;
          await Linking.openURL(smsUrl);
        } catch (contactError) {
          console.warn(`Failed to notify contact ${contact.name}:`, contactError);
        }
      }
    } catch (error) {
      console.error('Error notifying contacts:', error);
    }
  }

  /**
   * Send emergency alert to server
   */
  private async sendEmergencyAlert(alert: EmergencyAlert): Promise<void> {
    try {
      await apiClient.post('/emergency/alerts', alert);
      
      // Also store locally for offline capability
      await AsyncStorage.setItem(`@emergency_alert_${alert.id}`, JSON.stringify(alert));
    } catch (error) {
      console.error('Error sending emergency alert:', error);
      // Still store locally even if server fails
      try {
        await AsyncStorage.setItem(`@emergency_alert_${alert.id}`, JSON.stringify(alert));
      } catch (storageError) {
        console.error('Failed to store emergency alert locally:', storageError);
      }
    }
  }

  /**
   * Update emergency location on server
   */
  private async updateEmergencyLocation(alertId: string, location: EmergencyLocation): Promise<void> {
    try {
      await apiClient.put(`/emergency/alerts/${alertId}/location`, { location });
    } catch (error) {
      console.error('Error updating emergency location:', error);
    }
  }

  /**
   * Resolve emergency alert
   */
  async resolveEmergency(alertId?: string): Promise<void> {
    try {
      const activeAlert = this.currentAlert || (alertId ? await this.getEmergencyAlert(alertId) : null);
      
      if (!activeAlert) {
        Alert.alert('No Active Emergency', 'There is no active emergency to resolve.');
        return;
      }

      Alert.alert(
        'Resolve Emergency',
        'Are you safe? This will mark the emergency as resolved.',
        [
          { text: 'No - Keep Active', style: 'cancel' },
          { 
            text: 'Yes - Resolve', 
            style: 'default',
            onPress: async () => {
              await this.markEmergencyResolved(activeAlert.id);
              this.stopLocationTracking();
              this.currentAlert = null;
              Alert.alert('Emergency Resolved', 'Emergency has been marked as resolved. Stay safe!');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error resolving emergency:', error);
      Alert.alert('Error', 'Unable to resolve emergency.');
    }
  }

  /**
   * Mark emergency as resolved on server
   */
  private async markEmergencyResolved(alertId: string): Promise<void> {
    try {
      await apiClient.put(`/emergency/alerts/${alertId}`, { status: 'resolved' });
    } catch (error) {
      console.error('Error marking emergency resolved:', error);
    }
  }

  /**
   * Get emergency alert by ID
   */
  private async getEmergencyAlert(alertId: string): Promise<EmergencyAlert | null> {
    try {
      const stored = await AsyncStorage.getItem(`@emergency_alert_${alertId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error getting emergency alert:', error);
      return null;
    }
  }

  /**
   * Get current user ID
   */
  private async getCurrentUserId(): Promise<string> {
    try {
      const userData = await AsyncStorage.getItem('@user_data');
      if (userData) {
        const user = JSON.parse(userData);
        return user.id || 'unknown';
      }
      return 'unknown';
    } catch (error) {
      console.error('Error getting user ID:', error);
      return 'unknown';
    }
  }

  /**
   * Navigate to emergency settings (placeholder)
   */
  private navigateToEmergencySettings(): void {
    // This would navigate to emergency settings screen
    console.log('Navigate to emergency settings');
  }

  /**
   * Show emergency interface modal
   */
  private showEmergencyInterface(alert: EmergencyAlert): void {
    Alert.alert(
      '🚨 Emergency Alert Sent',
      `Emergency alert activated. Your location is being shared with emergency contacts.\n\nType: ${alert.type}\nTime: ${new Date(alert.timestamp).toLocaleString()}`,
      [
        { text: 'Call 911', onPress: () => this.callEmergencyServices() },
        { text: 'Call Emergency Contact', onPress: () => this.callPrimaryContact() },
        { text: 'I\'m Safe', onPress: () => this.resolveEmergency(alert.id) }
      ]
    );
  }

  /**
   * Check if there's an active emergency
   */
  hasActiveEmergency(): boolean {
    return this.currentAlert !== null && this.currentAlert.status === 'active';
  }

  /**
   * Get current active emergency
   */
  getCurrentEmergency(): EmergencyAlert | null {
    return this.currentAlert;
  }
}

export default EmergencyService.getInstance();