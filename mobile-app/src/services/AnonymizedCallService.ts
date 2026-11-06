/**
 * @fileoverview Phoning the other person on a ride from the app.
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-11-05
 *
 * The plan was to hide both numbers behind a relay number from the server.
 * That relay was never built: this asked POST /calls/masked, which does not
 * exist, so every call waited on a failed request and then fell back to the
 * real number anyway. It now goes straight to that fallback: it says the
 * number will be visible, then dials it if the user agrees.
 *
 * When a masking provider is set up, request the relay number in
 * initiateCall before the warning and dial that instead.
 */

import { Linking, Alert, Platform } from 'react-native';
import logger from './LoggingService';

const log = logger.createLogger('AnonymizedCallService');

interface CallSession {
  rideId: string;
  callerId: string;
  recipientId: string;
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
   * Phone another user on a ride. Their number and the caller's are visible
   * to each other, so the user is asked first.
   *
   * @returns whether the dialler was opened
   */
  async initiateCall(
    rideId: string,
    callerId: string,
    recipientId: string,
    recipientName: string,
    phoneNumber?: string,
  ): Promise<boolean> {
    if (!phoneNumber) {
      log.warn('No phone number to call', { rideId, recipientId });
      return false;
    }

    return new Promise((resolve) => {
      Alert.alert(
        `Call ${recipientName}`,
        'Your phone number will be visible to the other person.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Call',
            onPress: async () => {
              const opened = await this.dialNumber(phoneNumber);
              if (opened) {
                this.activeSession = {
                  rideId,
                  callerId,
                  recipientId,
                  startedAt: new Date().toISOString(),
                  status: 'initiating',
                };
              }
              resolve(opened);
            },
          },
        ],
      );
    });
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
    } catch (error) {
      log.error('Could not open the dialler', error);
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
