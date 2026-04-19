/**
 * @fileoverview Firebase Cloud Messaging service for push notifications
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import logger from '../utils/logger';

interface PushPayload {
  token: string;
  title: string;
  body: string;
  imageUrl?: string | undefined;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
  androidChannelId?: string;
  sound?: string;
}

class FCMService {
  private messaging: any = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const projectId = process.env['FIREBASE_PROJECT_ID'];
    const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
    const privateKey = process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      logger.warn('FCM: Firebase credentials not configured — push notifications disabled. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY to enable.');
      return;
    }

    try {
      // Dynamic require so the app starts even if firebase-admin isn't installed
      const admin = require('firebase-admin');

      // Only initialize if not already done (handles hot reload)
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        });
      }

      this.messaging = admin.messaging();
      this.initialized = true;
      logger.info('FCM: Firebase Admin initialized successfully');
    } catch (error) {
      logger.error('FCM: Failed to initialize Firebase Admin', { error });
    }
  }

  async send(payload: PushPayload): Promise<boolean> {
    if (!this.initialized || !this.messaging) {
      logger.debug('FCM: Skipping push — not initialized', { title: payload.title });
      return false;
    }

    const message = {
      token: payload.token,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data || {},
      android: {
        priority: payload.priority === 'high' ? 'high' as const : 'normal' as const,
        notification: {
          channelId: payload.androidChannelId || 'default',
          sound: payload.sound || 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: payload.sound || 'default',
            badge: 1,
            'content-available': 1,
          },
        },
      },
    };

    try {
      const response = await this.messaging.send(message);
      logger.info('FCM: Push notification sent', { messageId: response, title: payload.title });
      return true;
    } catch (error: any) {
      // Token is stale — caller should remove it
      if (error?.code === 'messaging/registration-token-not-registered' ||
          error?.code === 'messaging/invalid-registration-token') {
        logger.warn('FCM: Stale push token', { token: payload.token.slice(0, 20) + '...' });
        throw new StalePushTokenError(payload.token);
      }
      logger.error('FCM: Failed to send push notification', { error: error?.message, title: payload.title });
      return false;
    }
  }

  async sendMulticast(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<{ successCount: number; failureCount: number }> {
    if (!this.initialized || !this.messaging || tokens.length === 0) {
      return { successCount: 0, failureCount: tokens.length };
    }

    const message = {
      tokens,
      notification: { title, body },
      data: data || {},
    };

    try {
      const response = await this.messaging.sendEachForMulticast(message);
      logger.info('FCM: Multicast sent', {
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
      return { successCount: response.successCount, failureCount: response.failureCount };
    } catch (error) {
      logger.error('FCM: Multicast failed', { error });
      return { successCount: 0, failureCount: tokens.length };
    }
  }

  isReady(): boolean {
    return this.initialized;
  }
}

export class StalePushTokenError extends Error {
  constructor(public readonly token: string) {
    super('Push token is no longer valid');
    this.name = 'StalePushTokenError';
  }
}

export const fcmService = new FCMService();
export default fcmService;
