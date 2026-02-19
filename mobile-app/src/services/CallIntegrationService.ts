/**
 * @fileoverview Call Integration Service - Manages call workflows for ride-sharing
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { CallService, Call, CallInitiationRequest } from './CallService';
import SocketService from './SocketService';
import { ApiClient } from './ApiClient';
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
  callType: 'voice' | 'video' | 'emergency';
  from: string;
  caller?: {
    id: string;
    name: string;
  };
  isEmergency?: boolean;
}

// Call ended event data
interface CallEndedData {
  callId: string;
  reason?: string;
  duration?: number;
}

// Call error event data
interface CallErrorData {
  callId?: string;
  error: string;
  code?: string;
}

// Workflow event data
interface WorkflowEventData {
  workflow: CallWorkflow;
}

// Emergency call request event data
interface EmergencyCallRequestEventData {
  request: EmergencyCallRequest;
}

// Event listener callback type
type CallEventCallback = (data: unknown) => void;

export interface CallContext {
  rideId?: string;
  deliveryId?: string;
  participantId: string;
  participantName: string;
  participantRole: 'driver' | 'passenger' | 'courier' | 'customer';
  isEmergency?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CallWorkflow {
  id: string;
  contextType: 'ride' | 'delivery' | 'support' | 'emergency';
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
  participants: Array<{
    userId: string;
    role: string;
    status: 'invited' | 'joined' | 'declined' | 'disconnected';
    joinedAt?: string;
    leftAt?: string;
  }>;
  callHistory: Call[];
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyCallRequest {
  type: 'safety' | 'medical' | 'security' | 'breakdown';
  location: { lat: number; lng: number };
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  rideId?: string;
  deliveryId?: string;
}

export class CallIntegrationService {
  private static instance: CallIntegrationService;
  private apiClient = new ApiClient();
  private socketService = SocketService.getInstance();
  private navigation: NavigationRef | null = null;
  private activeWorkflows = new Map<string, CallWorkflow>();
  private callEventListeners = new Map<string, CallEventCallback[]>();

  private constructor() {
    this.setupEventHandlers();
  }

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

    // Initialize CallService
    await CallService.initialize();

    // Setup call event listeners
    CallService.addEventListener('incoming_call', ((data: unknown) => this.handleIncomingCall(data as any)) as import('./CallService').CallEventCallback);
    CallService.addEventListener('call_ended', ((data: unknown) => this.handleCallEnded(data)) as import('./CallService').CallEventCallback);
    CallService.addEventListener('call_error', ((data: unknown) => this.handleCallError(data)) as import('./CallService').CallEventCallback);

    log.info('CallIntegrationService initialized successfully');
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    // Handle call workflow events
    this.socketService.on('call_workflow_created', this.handleWorkflowCreated.bind(this));
    this.socketService.on('call_workflow_updated', this.handleWorkflowUpdated.bind(this));
    this.socketService.on('emergency_call_requested', this.handleEmergencyCallRequest.bind(this));
  }

  /**
   * Initiate a call within a specific context
   */
  async initiateCall(
    participantId: string,
    callType: 'voice' | 'video' | 'emergency',
    context: CallContext
  ): Promise<boolean> {
    try {
      // Check if calling is available
      if (!CallService.isCallingSupportAvailable()) {
        throw new Error('Calling features are not available on this device');
      }

      // Create call workflow
      const workflow = await this.createCallWorkflow(context);
      if (!workflow) {
        throw new Error('Failed to create call workflow');
      }

      // Prepare call request
      const callRequest: CallInitiationRequest = {
        calleeId: participantId,
        callType,
        rideId: context.rideId,
        deliveryId: context.deliveryId,
        isEmergency: context.isEmergency,
      };

      // Initiate the call
      const success = await CallService.initiateCall(callRequest);
      
      if (success) {
        // Update workflow status
        await this.updateWorkflowStatus(workflow.id, 'active');
        
        // Navigate to active call screen
        if (this.navigation) {
          this.navigation.navigate('ActiveCall', {
            callId: 'temp_' + Date.now(),
            callType,
            isIncoming: false,
          });
        }
        
        this.emitEvent('call_initiated', { workflowId: workflow.id, participantId, callType });
      }

      return success;
    } catch (error: unknown) {
      log.error('Error initiating call:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      this.emitEvent('call_error', { error: errMsg, participantId, callType });
      return false;
    }
  }

  /**
   * Handle incoming call
   */
  private handleIncomingCall(data: { callId: string; sessionId?: string; callType: string; from: string; caller: string; isEmergency?: boolean }): void {
    log.info('Incoming call received:', data);
    
    // Navigate to incoming call screen
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

  /**
   * Handle call ended
   */
  private handleCallEnded(data: unknown): void {
    log.info('Call ended:', data);
    
    // Update any active workflows
    this.activeWorkflows.forEach(async (workflow) => {
      if (workflow.status === 'active') {
        await this.updateWorkflowStatus(workflow.id, 'completed');
      }
    });
    
    this.emitEvent('call_ended', data);
  }

  /**
   * Handle call error
   */
  private handleCallError(data: unknown): void {
    log.error('Call error:', data);
    
    // Update any active workflows
    this.activeWorkflows.forEach(async (workflow) => {
      if (workflow.status === 'active') {
        await this.updateWorkflowStatus(workflow.id, 'failed');
      }
    });
    
    this.emitEvent('call_error', data);
  }

  /**
   * Create an emergency call
   */
  async createEmergencyCall(request: EmergencyCallRequest): Promise<boolean> {
    try {
      // Create emergency call workflow
      const workflow = await this.createEmergencyWorkflow(request);
      if (!workflow) {
        throw new Error('Failed to create emergency workflow');
      }

      // Get emergency contact based on type and location
      const emergencyContact = await this.getEmergencyContact(request);
      if (!emergencyContact) {
        throw new Error('No emergency contact available');
      }

      // Initiate emergency call
      const context: CallContext = {
        participantId: emergencyContact.id,
        participantName: emergencyContact.name,
        participantRole: 'customer', // Use customer role for emergency support
        isEmergency: true,
        rideId: request.rideId,
        deliveryId: request.deliveryId,
        metadata: {
          emergencyType: request.type,
          severity: request.severity,
          location: request.location,
          description: request.description,
        },
      };

      return await this.initiateCall(emergencyContact.id, 'video', context);
    } catch (error: unknown) {
      log.error('Error creating emergency call:', error);
      return false;
    }
  }

  /**
   * Get call history for a specific context
   */
  async getCallHistory(contextId: string, contextType: 'ride' | 'delivery'): Promise<Call[]> {
    try {
      const response = await this.apiClient.get(`/calls/history/${contextType}/${contextId}`);
      
      if (response.success) {
        return response.data.calls || [];
      }
      
      return [];
    } catch (error) {
      log.error('Error getting call history:', error);
      return [];
    }
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
   * Create a call workflow
   */
  private async createCallWorkflow(context: CallContext): Promise<CallWorkflow | null> {
    try {
      const response = await this.apiClient.post('/calls/workflows/create', {
        contextType: context.rideId ? 'ride' : context.deliveryId ? 'delivery' : 'support',
        contextId: context.rideId || context.deliveryId,
        participants: [
          { userId: 'current_user', role: 'initiator' },
          { userId: context.participantId, role: context.participantRole },
        ],
        metadata: context.metadata,
      });

      if (response.success) {
        const workflow = response.data.workflow;
        this.activeWorkflows.set(workflow.id, workflow);
        return workflow;
      }

      return null;
    } catch (error) {
      log.error('Error creating call workflow:', error);
      return null;
    }
  }

  /**
   * Create emergency workflow
   */
  private async createEmergencyWorkflow(request: EmergencyCallRequest): Promise<CallWorkflow | null> {
    try {
      const response = await this.apiClient.post('/calls/workflows/emergency', request);

      if (response.success) {
        const workflow = response.data.workflow;
        this.activeWorkflows.set(workflow.id, workflow);
        return workflow;
      }

      return null;
    } catch (error) {
      log.error('Error creating emergency workflow:', error);
      return null;
    }
  }

  /**
   * Update workflow status
   */
  private async updateWorkflowStatus(workflowId: string, status: string): Promise<void> {
    try {
      await this.apiClient.put(`/calls/workflows/${workflowId}/status`, { status });
      
      const workflow = this.activeWorkflows.get(workflowId);
      if (workflow) {
        workflow.status = status as CallWorkflow['status'];
        workflow.updatedAt = new Date().toISOString();
      }
    } catch (error) {
      log.error('Error updating workflow status:', error);
    }
  }

  /**
   * Get emergency contact
   */
  private async getEmergencyContact(request: EmergencyCallRequest): Promise<{
    id: string;
    name: string;
    type: string;
  } | null> {
    try {
      const response = await this.apiClient.post('/emergency/contacts/find', {
        type: request.type,
        location: request.location,
        severity: request.severity,
      });

      if (response.success) {
        return response.data.contact;
      }

      return null;
    } catch (error) {
      log.error('Error getting emergency contact:', error);
      return null;
    }
  }

  /**
   * Handle workflow created event
   */
  private handleWorkflowCreated(data: { workflow?: CallWorkflow }): void {
    log.info('Call workflow created:', data);
    if (data.workflow) {
      this.activeWorkflows.set(data.workflow.id, data.workflow);
    }
  }

  /**
   * Handle workflow updated event
   */
  private handleWorkflowUpdated(data: { workflow?: CallWorkflow }): void {
    log.info('Call workflow updated:', data);
    if (data.workflow) {
      this.activeWorkflows.set(data.workflow.id, data.workflow);
    }
  }

  /**
   * Handle emergency call request event
   */
  private handleEmergencyCallRequest(data: { request: EmergencyCallRequest }): void {
    log.info('Emergency call requested:', data);
    // Auto-initiate emergency call
    this.createEmergencyCall(data.request);
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
    this.activeWorkflows.clear();
    this.callEventListeners.clear();
    this.navigation = null;
  }
}

export default CallIntegrationService;