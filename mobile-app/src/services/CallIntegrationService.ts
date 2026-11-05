/**
 * @fileoverview Opens the incoming-call screen when someone calls in the app.
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2026-11-05
 *
 * This also used to place outgoing calls, through "call workflows" it created
 * on the server at /calls/workflows/*, and it auto-dialled a video call when
 * the server sent `emergency_call_requested`. None of that server side exists:
 * there are no workflow routes, /emergency/contacts/find is not served, and
 * the server never sends that event. Nothing in the app called the outgoing
 * half either. Ride calls go through AnonymizedCallService and SOS goes
 * through EmergencyService. The dead half was removed so it cannot be wired
 * to a button and fail.
 */

import { CallService, Call } from './CallService';
import logger from './LoggingService';

const log = logger.createLogger('CallIntegrationService');

// Navigation reference type
interface NavigationRef {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
}

// Incoming call event data
interface IncomingCallData {
  callId: string;
  sessionId?: string;
  callType: string;
  from: string;
  caller: string;
  isEmergency?: boolean;
}

// Event listener callback type
type CallEventCallback = (data: unknown) => void;

export class CallIntegrationService {
  private static instance: CallIntegrationService;
  private navigation: NavigationRef | null = null;
  private callEventListeners = new Map<string, CallEventCallback[]>();

  static getInstance(): CallIntegrationService {
    if (!CallIntegrationService.instance) {
      CallIntegrationService.instance = new CallIntegrationService();
    }
    return CallIntegrationService.instance;
  }

  /**
   * Initialize the service with navigation
   */
  async initialize(navigationRef: NavigationRef): Promise<void> {
    this.navigation = navigationRef;

    await CallService.initialize();

    CallService.addEventListener('incoming_call', ((data: unknown) => this.handleIncomingCall(data as IncomingCallData)) as import('./CallService').CallEventCallback);
    CallService.addEventListener('call_ended', ((data: unknown) => this.handleCallEnded(data)) as import('./CallService').CallEventCallback);
    CallService.addEventListener('call_error', ((data: unknown) => this.handleCallError(data)) as import('./CallService').CallEventCallback);

    log.info('CallIntegrationService initialized successfully');
  }

  /**
   * Handle incoming call
   */
  private handleIncomingCall(data: IncomingCallData): void {
    log.info('Incoming call received:', data);

    if (this.navigation) {
      this.navigation.navigate('IncomingCall', {
        callId: data.callId,
        sessionId: data.sessionId || data.callId,
        callType: data.callType,
        from: data.from,
        caller: data.caller,
        isEmergency: data.isEmergency || false,
      });
    }

    this.emitEvent('incoming_call_received', data);
  }

  private handleCallEnded(data: unknown): void {
    log.info('Call ended:', data);
    this.emitEvent('call_ended', data);
  }

  private handleCallError(data: unknown): void {
    log.error('Call error:', data);
    this.emitEvent('call_error', data);
  }

  /**
   * Check if user is currently in a call
   */
  isInCall(): boolean {
    return CallService.isInCall();
  }

  /**
   * Get active call information
   */
  getActiveCall(): Call | null {
    return CallService.getActiveCall();
  }

  /**
   * Event management
   */
  addEventListener(event: string, callback: CallEventCallback): void {
    if (!this.callEventListeners.has(event)) {
      this.callEventListeners.set(event, []);
    }
    this.callEventListeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: CallEventCallback): void {
    const listeners = this.callEventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: string, data: unknown): void {
    const listeners = this.callEventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          log.error('Error in call event listener:', error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.callEventListeners.clear();
    this.navigation = null;
  }
}

export default CallIntegrationService;
