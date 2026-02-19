/**
 * @fileoverview Anonymized calling service - masks real phone numbers for privacy
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import { Linking, Alert, Platform } from 'react-native';
import { getApiConfig } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from './LoggingService';

const log = logger.createLogger('AnonymizedCallService');

interface CallSession {
  rideId: string;
  callerId: string;
  recipientId: string;
  maskedNumber?: string;
  startedAt: string;
  status: 'initiating' | 'ringing' | 'active' | 'ended';
}

class AnonymizedCallService {
  private static instance: AnonymizedCallService;
  private activeSession: CallSession | null = null;

  static getInstance(): AnonymizedCallService {
    if (!AnonymizedCallService.instance) {
      AnonymizedCallService.instance = new AnonymizedCallService();
    }
    return AnonymizedCallService.instance;
  }

  /**
   * Initiate an anonymized call to another user in a ride.
   * Tries backend relay first, falls back to direct call with privacy warning.
   */
  async initiateCall(
    rideId: string,
    callerId: string,
    recipientId: string,
    recipientName: string,
    fallbackNumber?: string,
  ): Promise<boolean> {
    try {
      // Try backend relay endpoint first
      const maskedNumber = await this.requestMaskedNumber(rideId, callerId, recipientId);

      if (maskedNumber) {
        this.activeSession = {
          rideId,
          callerId,
          recipientId,
          maskedNumber,
          startedAt: new Date().toISOString(),
          status: 'initiating',
        };

        return this.dialNumber(maskedNumber);
      }

      // Fallback: prompt user to call directly with warning
      if (fallbackNumber) {
        return new Promise((resolve) => {
          Alert.alert(
            `Call ${recipientName}`,
            'Masked calling is not available. Your phone number will be visible to the other party.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              {
                text: 'Call Anyway',
                onPress: async () => {
                  const success = await this.dialNumber(fallbackNumber);
                  resolve(success);
                },
              },
            ],
          );
        });
      }

      return false;
    } catch (error) {
      log.error('Call initiation failed', error);
      return false;
    }
  }

  /**
   * Request a masked/relay number from the backend
   */
  private async requestMaskedNumber(
    rideId: string,
    callerId: string,
    recipientId: string,
  ): Promise<string | null> {
    try {
      const { apiUrl } = getApiConfig();
      const token = await AsyncStorage.getItem('@aryv_auth_token')
        || await AsyncStorage.getItem('accessToken');

      if (!token || !apiUrl) return null;

      const response = await fetch(`${apiUrl}/calls/masked`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rideId, callerId, recipientId }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.maskedNumber || null;
      }

      return null;
    } catch {
      // Backend not available — fall back gracefully
      return null;
    }
  }

  /**
   * Dial a phone number
   */
  private async dialNumber(number: string): Promise<boolean> {
    try {
      const phoneUrl = Platform.OS === 'ios'
        ? `telprompt:${number}`
        : `tel:${number}`;

      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (canOpen) {
        await Linking.openURL(phoneUrl);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * End the current call session
   */
  endCall(): void {
    if (this.activeSession) {
      this.activeSession.status = 'ended';
      this.activeSession = null;
    }
  }

  /**
   * Get current active session
   */
  getActiveSession(): CallSession | null {
    return this.activeSession;
  }
}

export default AnonymizedCallService;
