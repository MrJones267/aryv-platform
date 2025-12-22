/**
 * @fileoverview Call Service for mobile WebRTC calling
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

// WebRTC type declarations
declare global {
  interface RTCIceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
  }
  
  class RTCPeerConnection {
    addIceCandidate: any;
    addStream: any;
    createOffer: any;
    createAnswer: any;
    setLocalDescription: any;
    setRemoteDescription: any;
    onicecandidate: any;
    onaddstream: any;
    close: any;
    getLocalStreams: any;
    getRemoteStreams: any;
    constructor(config?: any);
  }
  
  class MediaStream {
    id: string;
    active: boolean;
    getTracks: () => any[];
    getAudioTracks: () => any[];
    getVideoTracks: () => any[];
  }
}

import { ApiClient } from './ApiClient';
import SocketService from './SocketService';

export interface Call {
  id: string;
  callerId: string;
  calleeId: string;
  callType: 'voice' | 'video' | 'emergency';
  callPurpose: string;
  status: 'initiated' | 'ringing' | 'accepted' | 'rejected' | 'ended' | 'failed' | 'missed';
  rideId?: string;
  deliveryId?: string;
  isEmergency: boolean;
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  quality: number;
  caller?: {
    id: string;
    name: string;
    avatar?: string;
  };
  callee?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface CallInitiationRequest {
  calleeId: string;
  callType: 'voice' | 'video' | 'emergency';
  rideId?: string;
  deliveryId?: string;
  isEmergency?: boolean;
}

export interface WebRTCConfiguration {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
}

export class CallService {
  private static apiClient = new ApiClient();
  private static socketService = SocketService.getInstance();
  private static peerConnection: RTCPeerConnection | null = null;
  private static localStream: MediaStream | null = null;
  private static remoteStream: MediaStream | null = null;
  private static activeCall: Call | null = null;
  private static callEventListeners: Map<string, Function[]> = new Map();
  private static isWebRTCAvailable = false;

  /**
   * Initialize CallService and check WebRTC availability
   */
  static async initialize(): Promise<void> {
    try {
      // Check if WebRTC is available
      this.isWebRTCAvailable = typeof RTCPeerConnection !== 'undefined';
      
      if (!this.isWebRTCAvailable) {
        console.warn('WebRTC not available - Call features will be limited');
        return;
      }
      
      // Set up socket event listeners for call signaling
      this.setupSocketListeners();
      
      console.log('CallService initialized with WebRTC support');
    } catch (error: any) {
      console.error('CallService initialization failed:', error);
      this.isWebRTCAvailable = false;
    }
  }

  /**
   * Check if WebRTC features are available
   */
  static isCallingSupportAvailable(): boolean {
    return this.isWebRTCAvailable;
  }

  /**
   * WebRTC configuration with STUN servers
   */
  private static getWebRTCConfig(): WebRTCConfiguration {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // Add TURN servers for production
        // { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
      ],
      iceCandidatePoolSize: 10,
    };
  }

  /**
   * Initialize WebRTC peer connection
   */
  private static async initializePeerConnection(): Promise<RTCPeerConnection> {
    try {
      if (this.peerConnection) {
        this.peerConnection.close();
      }

      // Check if WebRTC is available
      if (typeof RTCPeerConnection === 'undefined') {
        throw new Error('WebRTC native module not found. WebRTC features are disabled.');
      }

      const config = this.getWebRTCConfig();
      this.peerConnection = new RTCPeerConnection(config);
    } catch (error: any) {
      console.warn('WebRTC initialization failed:', error);
      throw error;
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event: any) => {
      if (event.candidate && this.activeCall) {
        this.socketService.emit('call_signal', {
          type: 'ice-candidate',
          sessionId: this.activeCall.id,
          data: event.candidate,
          to: this.getOtherParticipantId(),
        });
      }
    };

    // Handle remote stream
    (this.peerConnection as any).ontrack = (event: any) => {
      this.remoteStream = event.streams[0];
      this.emitCallEvent('remote_stream_received', { stream: this.remoteStream });
    };

    // Handle connection state changes
    (this.peerConnection as any).onconnectionstatechange = () => {
      const state = (this.peerConnection as any)?.connectionState;
      this.emitCallEvent('connection_state_changed', { state });
      
      if (state === 'failed' || state === 'disconnected') {
        this.handleCallError('Connection failed');
      }
    };

    return this.peerConnection;
  }


  /**
   * Set up socket event listeners for WebRTC signaling
   */
  private static setupSocketListeners(): void {
    // Incoming call notification
    this.socketService.on('incoming_call', (data: any) => {
      this.activeCall = {
        id: data.callId,
        callerId: data.from,
        calleeId: data.to,
        callType: data.callType,
        callPurpose: 'ride_communication',
        status: 'ringing',
        isEmergency: data.isEmergency,
        quality: 5,
        caller: data.caller,
      };
      
      this.emitCallEvent('incoming_call', data);
    });

    // Call accepted
    this.socketService.on('call_accepted', (data: any) => {
      if (this.activeCall) {
        this.activeCall.status = 'accepted';
        this.emitCallEvent('call_accepted', data);
      }
    });

    // Call rejected
    this.socketService.on('call_rejected', (data: any) => {
      this.handleCallEnd(data);
      this.emitCallEvent('call_rejected', data);
    });

    // Call ended
    this.socketService.on('call_ended', (data: any) => {
      this.handleCallEnd(data);
      this.emitCallEvent('call_ended', data);
    });

    // WebRTC signaling
    this.socketService.on('call_signal', async (data: any) => {
      await this.handleSignalingData(data);
    });

    // Call errors
    this.socketService.on('call_error', (data: any) => {
      this.handleCallError(data.message);
    });

    // Call initiated confirmation
    this.socketService.on('call_initiated', (data: any) => {
      if (this.activeCall) {
        this.activeCall.status = 'ringing';
        this.emitCallEvent('call_initiated', data);
      }
    });
  }

  /**
   * Initiate a call
   */
  static async initiateCall(request: CallInitiationRequest): Promise<boolean> {
    try {
      // Check if already in a call
      if (this.activeCall && this.activeCall.status !== 'ended') {
        throw new Error('Already in an active call');
      }

      // Request permissions
      await this.requestPermissions(request.callType === 'emergency' ? 'video' : request.callType);

      // Get local media stream
      this.localStream = await this.getLocalMedia(request.callType === 'emergency' ? 'video' : request.callType);

      // Initialize peer connection
      await this.initializePeerConnection();

      // Add local stream to peer connection
      if (this.localStream && this.peerConnection) {
        this.localStream.getTracks().forEach((track: any) => {
          (this.peerConnection as any)!.addTrack(track, this.localStream!);
        });
      }

      // Create call object
      this.activeCall = {
        id: 'temp_' + Date.now(), // Will be replaced by server response
        callerId: 'current_user', // Will be set by server
        calleeId: request.calleeId,
        callType: request.callType,
        callPurpose: 'ride_communication',
        status: 'initiated',
        rideId: request.rideId,
        deliveryId: request.deliveryId,
        isEmergency: request.isEmergency || false,
        quality: 5,
      };

      // Send initiation request via socket
      this.socketService.emit('call_initiate', {
        to: request.calleeId,
        callType: request.callType,
        rideId: request.rideId,
        deliveryId: request.deliveryId,
        isEmergency: request.isEmergency,
      });

      this.emitCallEvent('local_stream_received', { stream: this.localStream });
      return true;

    } catch (error: any) {
      console.error('Error initiating call:', error);
      this.handleCallError(error.message);
      return false;
    }
  }

  /**
   * Accept an incoming call
   */
  static async acceptCall(): Promise<boolean> {
    try {
      if (!this.activeCall) {
        throw new Error('No active call to accept');
      }

      // Request permissions
      await this.requestPermissions(this.activeCall.callType === 'emergency' ? 'video' : this.activeCall.callType);

      // Get local media stream
      this.localStream = await this.getLocalMedia(this.activeCall.callType === 'emergency' ? 'video' : this.activeCall.callType);

      // Initialize peer connection
      await this.initializePeerConnection();

      // Add local stream to peer connection
      if (this.localStream && this.peerConnection) {
        this.localStream.getTracks().forEach((track: any) => {
          (this.peerConnection as any)!.addTrack(track, this.localStream!);
        });
      }

      // Accept call via socket
      this.socketService.emit('call_accept', {
        callId: this.activeCall.id,
      });

      this.emitCallEvent('local_stream_received', { stream: this.localStream });
      return true;

    } catch (error: any) {
      console.error('Error accepting call:', error);
      this.handleCallError(error.message);
      return false;
    }
  }

  /**
   * Reject an incoming call
   */
  static async rejectCall(reason?: string): Promise<void> {
    try {
      if (!this.activeCall) {
        return;
      }

      this.socketService.emit('call_reject', {
        callId: this.activeCall.id,
        reason,
      });

      this.handleCallEnd({ reason: 'rejected' });

    } catch (error: any) {
      console.error('Error rejecting call:', error);
    }
  }

  /**
   * End an active call
   */
  static async endCall(reason?: string): Promise<void> {
    try {
      if (!this.activeCall) {
        return;
      }

      this.socketService.emit('call_end', {
        callId: this.activeCall.id,
        reason,
      });

      this.handleCallEnd({ reason: reason || 'ended_by_user' });

    } catch (error: any) {
      console.error('Error ending call:', error);
    }
  }

  /**
   * Toggle video (for video calls)
   */
  static toggleVideo(): boolean {
    if (!this.localStream) return false;

    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      const isEnabled = videoTracks[0].enabled;
      videoTracks[0].enabled = !isEnabled;
      this.emitCallEvent('video_toggled', { enabled: !isEnabled });
      return !isEnabled;
    }
    return false;
  }

  /**
   * Toggle audio (mute/unmute)
   */
  static toggleAudio(): boolean {
    if (!this.localStream) return false;

    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const isEnabled = audioTracks[0].enabled;
      audioTracks[0].enabled = !isEnabled;
      this.emitCallEvent('audio_toggled', { enabled: !isEnabled });
      return !isEnabled;
    }
    return false;
  }

  /**
   * Switch camera (front/back) for video calls
   */
  static async switchCamera(): Promise<boolean> {
    try {
      if (!this.localStream || this.activeCall?.callType !== 'video') {
        return false;
      }

      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length === 0) return false;

      // Stop current video track
      videoTracks[0].stop();

      // Get new video stream with opposite facing mode
      const currentTrack = videoTracks[0];
      const settings = currentTrack.getSettings();
      const newFacingMode = settings.facingMode === 'user' ? 'environment' : 'user';

      const newStream = await (global as any).navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false,
      });

      // Replace video track in peer connection
      const sender = (this.peerConnection as any)?.getSenders().find(
        (s: any) => s.track && s.track.kind === 'video'
      );

      if (sender && newStream.getVideoTracks()[0]) {
        await sender.replaceTrack(newStream.getVideoTracks()[0]);
        
        // Update local stream
        (this.localStream as any).removeTrack(videoTracks[0]);
        (this.localStream as any).addTrack(newStream.getVideoTracks()[0]);
        
        this.emitCallEvent('camera_switched', { facingMode: newFacingMode });
        return true;
      }

      return false;

    } catch (error: any) {
      console.error('Error switching camera:', error);
      return false;
    }
  }

  /**
   * Update call quality rating
   */
  static async updateCallQuality(quality: number): Promise<boolean> {
    try {
      if (!this.activeCall) return false;

      const response = await this.apiClient.put(`/calls/${this.activeCall.id}/quality`, {
        quality,
      });

      if (response.success) {
        this.activeCall.quality = quality;
        return true;
      }

      return false;

    } catch (error: any) {
      console.error('Error updating call quality:', error);
      return false;
    }
  }

  /**
   * Get call history
   */
  static async getCallHistory(limit: number = 50, offset: number = 0): Promise<Call[]> {
    try {
      const response = await this.apiClient.get(`/calls/history?limit=${limit}&offset=${offset}`);
      
      if (response.success) {
        return response.data.calls;
      }

      return [];

    } catch (error: any) {
      console.error('Error fetching call history:', error);
      return [];
    }
  }

  /**
   * Private helper methods
   */

  private static async requestPermissions(callType: 'voice' | 'video'): Promise<void> {
    const permissions = ['microphone'];
    if (callType === 'video') {
      permissions.push('camera');
    }

    // Request permissions (implementation depends on platform)
    // This is a simplified version - actual implementation would use
    // react-native-permissions or similar
    console.log('Requesting permissions:', permissions);
  }

  private static async getLocalMedia(callType: 'voice' | 'video'): Promise<any> {
    const constraints = {
      audio: true,
      video: callType === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      } : false,
    };

    return await (global as any).navigator.mediaDevices.getUserMedia(constraints);
  }

  private static async handleSignalingData(data: any): Promise<void> {
    try {
      if (!this.peerConnection) {
        console.warn('Received signaling data but no peer connection');
        return;
      }

      switch (data.type) {
        case 'offer':
          await this.peerConnection.setRemoteDescription(data.data);
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          
          this.socketService.emit('call_signal', {
            type: 'answer',
            sessionId: data.sessionId,
            data: answer,
            to: data.from,
          });
          break;

        case 'answer':
          await this.peerConnection.setRemoteDescription(data.data);
          break;

        case 'ice-candidate':
          await this.peerConnection.addIceCandidate(data.data);
          break;

        default:
          console.warn('Unknown signaling type:', data.type);
      }

    } catch (error: any) {
      console.error('Error handling signaling data:', error);
      this.handleCallError('Signaling error');
    }
  }

  private static async handleCallEnd(data: any): Promise<void> {
    // Update call status
    if (this.activeCall) {
      this.activeCall.status = 'ended';
      this.activeCall.endedAt = new Date().toISOString();
    }

    // Clean up WebRTC resources
    this.cleanup();

    // Clear active call
    this.activeCall = null;
  }

  private static handleCallError(message: string): void {
    console.error('Call error:', message);
    this.emitCallEvent('call_error', { message });
    this.cleanup();
    this.activeCall = null;
  }

  private static cleanup(): void {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Clear remote stream
    this.remoteStream = null;
  }

  private static getOtherParticipantId(): string {
    if (!this.activeCall) return '';
    
    // Determine which participant we are and return the other one
    // This would be properly implemented based on user context
    return this.activeCall.calleeId; // Simplified
  }

  /**
   * Event management
   */
  static addEventListener(event: string, callback: Function): void {
    if (!this.callEventListeners.has(event)) {
      this.callEventListeners.set(event, []);
    }
    this.callEventListeners.get(event)!.push(callback);
  }

  static removeEventListener(event: string, callback: Function): void {
    const listeners = this.callEventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private static emitCallEvent(event: string, data: any): void {
    const listeners = this.callEventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error: any) {
          console.error('Error in call event listener:', error);
        }
      });
    }
  }

  /**
   * Getters
   */
  static getActiveCall(): Call | null {
    return this.activeCall;
  }

  static getLocalStream(): any | null {
    return this.localStream;
  }

  static getRemoteStream(): any | null {
    return this.remoteStream;
  }

  static isInCall(): boolean {
    return this.activeCall !== null && this.activeCall.status !== 'ended';
  }
}

export default CallService;