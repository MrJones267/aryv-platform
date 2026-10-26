/**
 * @fileoverview Call Service for Voice/Video calling with WebRTC signaling
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import Call, { CallType, CallStatus, CallPurpose } from '../models/Call';
import { User } from '../models';
import { NotificationService } from './NotificationService';
import { logInfo, logError, logWarning } from '../utils/logger';
import { emergencyService } from './EmergencyService';
import { EmergencyAlertType } from '../models/EmergencyAlert';

/** Botswana's emergency number. */
const EMERGENCY_NUMBER = '999';

export interface CallInitiationRequest {
  callerId: string;
  calleeId: string;
  callType: CallType;
  callPurpose: CallPurpose;
  rideId?: string;
  deliveryId?: string;
  isEmergency?: boolean;
  metadata?: any;
}

export interface CallResult {
  success: boolean;
  call?: Call;
  error?: string;
  sessionId?: string;
}

export interface CallSignalData {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-ended';
  sessionId: string;
  data: any;
  from: string;
  to: string;
}

export interface CallSession {
  id: string;
  callId: string;
  participants: string[];
  createdAt: Date;
  isActive: boolean;
}

export class CallService {
  private notificationService: NotificationService;
  private activeSessions: Map<string, CallSession> = new Map();

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Initiate a new call
   */
  async initiateCall(request: CallInitiationRequest): Promise<CallResult> {
    const transaction = await sequelize.transaction();

    try {
      // Validate users exist and are different
      if (request.callerId === request.calleeId) {
        throw new Error('Cannot call yourself');
      }

      const [caller, callee] = await Promise.all([
        User.findByPk(request.callerId, { transaction }),
        User.findByPk(request.calleeId, { transaction }),
      ]);

      if (!caller || !callee) {
        throw new Error('Invalid caller or callee');
      }

      // Check if users are already in an active call
      const activeCall = await this.getActiveCallForUser(request.callerId);
      if (activeCall) {
        throw new Error('User is already in an active call');
      }

      // Check callee availability
      const calleeActiveCall = await this.getActiveCallForUser(request.calleeId);
      if (calleeActiveCall) {
        throw new Error('Callee is busy in another call');
      }

      // Create call record
      const call = await (Call as any).create({
        callerId: request.callerId,
        calleeId: request.calleeId,
        callType: request.callType,
        callPurpose: request.callPurpose,
        rideId: request.rideId,
        deliveryId: request.deliveryId,
        isEmergency: request.isEmergency || false,
        recordingEnabled: this.shouldEnableRecording(request),
        status: 'INITIATED' as any,
        metadata: {
          ...request.metadata,
          initiatedFrom: 'mobile_app',
          timestamp: new Date().toISOString(),
        },
      }, { transaction });

      // Generate session ID
      const sessionId = `call_${call.id}_${Date.now()}`;

      // Create active session
      const session: CallSession = {
        id: sessionId,
        callId: call.id,
        participants: [request.callerId, request.calleeId],
        createdAt: new Date(),
        isActive: true,
      };

      this.activeSessions.set(sessionId, session);

      await transaction.commit();

      // Send notifications
      await this.sendCallNotifications(call, caller, callee);

      logInfo('Call initiated successfully', {
        callId: call.id,
        sessionId,
        callerId: request.callerId,
        calleeId: request.calleeId,
        callType: request.callType,
      });

      return {
        success: true,
        call,
        sessionId,
      };

    } catch (error) {
      await transaction.rollback();

      logError('Error initiating call', error as Error, {
        callerId: request.callerId,
        calleeId: request.calleeId,
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId: string, userId: string): Promise<CallResult> {
    try {
      const call = await Call.findByPk(callId);

      if (!call) {
        throw new Error('Call not found');
      }

      if (call.calleeId !== userId) {
        throw new Error('Only the callee can accept the call');
      }

      if (call.status !== CallStatus.INITIATED && call.status !== CallStatus.RINGING) {
        throw new Error(`Cannot accept call in status: ${call.status}`);
      }

      // Update call status
      await call.update({
        status: CallStatus.ACCEPTED,
        startedAt: new Date(),
      });

      // Notify both participants
      await this.notifyCallStatusChange(call, 'accepted');

      logInfo('Call accepted', {
        callId,
        userId,
        duration: 0,
      });

      return {
        success: true,
        call,
      };

    } catch (error) {
      logError('Error accepting call', error as Error, { callId, userId });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Reject an incoming call
   */
  async rejectCall(callId: string, userId: string, reason?: string): Promise<CallResult> {
    try {
      const call = await Call.findByPk(callId);

      if (!call) {
        throw new Error('Call not found');
      }

      if (call.calleeId !== userId) {
        throw new Error('Only the callee can reject the call');
      }

      if (!call.isActiveCall()) {
        throw new Error(`Cannot reject call in status: ${call.status}`);
      }

      // Update call status
      await call.update({
        status: CallStatus.REJECTED,
        endedAt: new Date(),
        metadata: {
          ...call.metadata,
          rejectionReason: reason || 'rejected_by_user',
        },
      });

      // Clean up session
      await this.cleanupCallSession(call.id);

      // Notify caller
      await this.notifyCallStatusChange(call, 'rejected');

      logInfo('Call rejected', {
        callId,
        userId,
        reason,
      });

      return {
        success: true,
        call,
      };

    } catch (error) {
      logError('Error rejecting call', error as Error, { callId, userId });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * End an active call
   */
  async endCall(callId: string, userId: string, reason?: string): Promise<CallResult> {
    try {
      const call = await Call.findByPk(callId);

      if (!call) {
        throw new Error('Call not found');
      }

      if (call.callerId !== userId && call.calleeId !== userId) {
        throw new Error('Only call participants can end the call');
      }

      if (call.status !== CallStatus.ACCEPTED) {
        throw new Error(`Cannot end call in status: ${call.status}`);
      }

      // Update call status
      await call.update({
        status: CallStatus.ENDED,
        endedAt: new Date(),
        metadata: {
          ...call.metadata,
          endReason: reason || 'ended_by_user',
          endedBy: userId,
        },
      });

      // Clean up session
      await this.cleanupCallSession(call.id);

      // Notify other participant
      await this.notifyCallStatusChange(call, 'ended');

      logInfo('Call ended', {
        callId,
        userId,
        duration: call.duration,
        reason,
      });

      return {
        success: true,
        call,
      };

    } catch (error) {
      logError('Error ending call', error as Error, { callId, userId });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Handle WebRTC signaling data
   */
  async handleSignaling(signalData: CallSignalData): Promise<boolean> {
    try {
      const session = this.activeSessions.get(signalData.sessionId);

      if (!session || !session.isActive) {
        logWarning('Received signaling for inactive session', { sessionId: signalData.sessionId });
        return false;
      }

      // Validate participant
      if (!session.participants.includes(signalData.from)) {
        logWarning('Unauthorized signaling attempt', {
          sessionId: signalData.sessionId,
          from: signalData.from,
        });
        return false;
      }

      // Log signaling event
      await this.logCallEvent(session.callId, 'signaling_data', {
        type: signalData.type,
        from: signalData.from,
        to: signalData.to,
        dataSize: JSON.stringify(signalData.data).length,
      });

      return true;

    } catch (error) {
      logError('Error handling signaling', error as Error, signalData);
      return false;
    }
  }

  /**
   * Get call history for a user
   */
  async getCallHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Call[]> {
    try {
      return await Call.findAll({
        where: {
          [Op.or]: [
            { callerId: userId },
            { calleeId: userId },
          ],
        },
        include: [
          {
            model: User,
            as: 'caller',
            attributes: ['id', 'firstName', 'lastName', 'profilePicture'],
          },
          {
            model: User,
            as: 'callee',
            attributes: ['id', 'firstName', 'lastName', 'profilePicture'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });
    } catch (error) {
      logError('Error fetching call history', error as Error, { userId });
      return [];
    }
  }

  /**
   * Get active call for a user
   */
  async getActiveCallForUser(userId: string): Promise<Call | null> {
    try {
      return await Call.findOne({
        where: {
          [Op.or]: [
            { callerId: userId },
            { calleeId: userId },
          ],
          status: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ACCEPTED],
        },
        include: [
          {
            model: User,
            as: 'caller',
            attributes: ['id', 'firstName', 'lastName', 'profilePicture'],
          },
          {
            model: User,
            as: 'callee',
            attributes: ['id', 'firstName', 'lastName', 'profilePicture'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });
    } catch (error) {
      logError('Error fetching active call', error as Error, { userId });
      return null;
    }
  }

  /**
   * Update call quality rating
   */
  async updateCallQuality(callId: string, userId: string, quality: number): Promise<boolean> {
    try {
      const call = await Call.findByPk(callId);

      if (!call) {
        throw new Error('Call not found');
      }

      if (call.callerId !== userId && call.calleeId !== userId) {
        throw new Error('Only call participants can rate the call');
      }

      if (quality < 1 || quality > 5) {
        throw new Error('Quality rating must be between 1 and 5');
      }

      await call.update({ quality });

      await this.logCallEvent(callId, 'quality_update', {
        rating: quality,
        ratedBy: userId,
      });

      return true;

    } catch (error) {
      logError('Error updating call quality', error as Error, { callId, userId, quality });
      return false;
    }
  }

  /**
   * Emergency call handling
   */
  /**
   * Handle a user asking for emergency help from the call UI.
   *
   * This used to place an in-app WebRTC call to "the first admin user", which
   * could not work: an admin is not the user's emergency contact, nobody is
   * sitting in the app waiting to answer, and with no admin row it failed with
   * "No emergency contact available" — leaving someone in an emergency with an
   * error message.
   *
   * An emergency contact is a person with a phone, usually not an ARYV user at
   * all, so there is no in-app peer to ring. What actually helps is raising a
   * real alert — which texts every contact with the user's location — and
   * putting the emergency number in front of the user, since dialling is the
   * one thing that works with no data and no account.
   */
  async initiateEmergencyCall(
    userId: string,
    location?: { latitude: number; longitude: number },
  ): Promise<{
    success: boolean;
    alertId?: string;
    contactsNotified?: number;
    emergencyNumber: string;
    primaryContactPhone?: string | null;
    error?: string;
  }> {
    try {
      if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
        // Without a position there is nothing to send responders. Still hand
        // back the number rather than only an error.
        return {
          success: false,
          error: 'A location is required to raise an emergency alert',
          emergencyNumber: EMERGENCY_NUMBER,
        };
      }

      const alert = await emergencyService.raiseAlert({
        userId,
        alertType: EmergencyAlertType.PANIC,
        coordinates: location,
      });

      const contacts = await emergencyService.getContacts(userId);
      const primary = contacts.find((contact) => contact.isPrimary) ?? contacts[0];

      return {
        success: true,
        alertId: alert.id,
        contactsNotified: alert.contactsNotified,
        emergencyNumber: EMERGENCY_NUMBER,
        // So the client can offer "call your contact" without a second round
        // trip at the moment it matters.
        primaryContactPhone: primary?.phone ?? null,
      };
    } catch (error) {
      logError('Error handling emergency call request', error as Error, { userId });

      return {
        success: false,
        error: (error as Error).message,
        emergencyNumber: EMERGENCY_NUMBER,
      };
    }
  }

  /**
   * Private helper methods
   */

  private shouldEnableRecording(request: CallInitiationRequest): boolean {
    // Enable recording for emergency calls and when legally compliant
    return request.isEmergency || request.callPurpose === CallPurpose.CUSTOMER_SUPPORT;
  }

  private async sendCallNotifications(call: Call, caller: any, callee: any): Promise<void> {
    try {
      // Notify callee about incoming call
      await (this.notificationService as any).sendNotification(callee.id, {
        title: `Incoming ${call.callType} call`,
        body: `${caller.firstName} ${caller.lastName} is calling you`,
        type: 'incoming_call',
        data: {
          callId: call.id,
          callType: call.callType,
          callerId: caller.id,
          callerName: `${caller.firstName} ${caller.lastName}`,
          callerAvatar: caller.profilePicture,
          isEmergency: call.isEmergency,
        },
      });

      // For emergency calls, also notify emergency contacts
      if (call.isEmergency) {
        await this.notifyEmergencyContacts(caller.id, call);
      }

    } catch (error) {
      logError('Error sending call notifications', error as Error);
    }
  }

  private async notifyCallStatusChange(call: Call, status: string): Promise<void> {
    try {
      const participants = [call.callerId, call.calleeId];

      for (const participantId of participants) {
        await (this.notificationService as any).sendNotification(participantId, {
          title: 'Call Status Update',
          body: `Call ${status}`,
          type: 'call_status_update',
          data: {
            callId: call.id,
            status,
            timestamp: new Date().toISOString(),
          },
        });
      }

    } catch (error) {
      logError('Error notifying call status change', error as Error);
    }
  }

  private async cleanupCallSession(callId: string): Promise<void> {
    try {
      // Find and remove active session
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (session.callId === callId) {
          session.isActive = false;
          this.activeSessions.delete(sessionId);
          break;
        }
      }

    } catch (error) {
      logError('Error cleaning up call session', error as Error, { callId });
    }
  }

  private async logCallEvent(callId: string, eventType: string, eventData: any): Promise<void> {
    logInfo('Call event', { callId, eventType, eventData });
  }


  /**
   * Alert the caller's emergency contacts about an emergency call.
   *
   * This was a log line reading "alerting emergency contacts" that alerted
   * nobody. It now goes through the emergency service, which texts every
   * contact with a location.
   */
  private async notifyEmergencyContacts(
    userId: string,
    call: Call,
    location?: { latitude: number; longitude: number },
  ): Promise<void> {
    try {
      if (!location) {
        logWarning('Emergency call has no location; contacts cannot be told where to go', {
          userId,
          callId: call.id,
        });
        return;
      }

      await emergencyService.raiseAlert({
        userId,
        alertType: EmergencyAlertType.PANIC,
        coordinates: location,
      });
    } catch (error) {
      logError('Error notifying emergency contacts', error as Error);
    }
  }

  /**
   * Get call statistics
   */
  async getCallStatistics(userId?: string): Promise<any> {
    try {
      const whereClause = userId ? {
        [Op.or]: [
          { callerId: userId },
          { calleeId: userId },
        ],
      } : {};

      const stats = await Call.findAll({
        where: whereClause,
        attributes: [
          'callType',
          'status',
          [sequelize.fn('COUNT', '*'), 'count'],
          [sequelize.fn('AVG', sequelize.col('duration')), 'avgDuration'],
          [sequelize.fn('AVG', sequelize.col('quality')), 'avgQuality'],
        ],
        group: ['callType', 'status'],
        raw: true,
      });

      return stats;

    } catch (error) {
      logError('Error fetching call statistics', error as Error, { userId });
      return [];
    }
  }
}

export default CallService;
