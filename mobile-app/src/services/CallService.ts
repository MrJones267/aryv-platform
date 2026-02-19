/**
 * @fileoverview Call Service for mobile WebRTC calling
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
} from 'react-native-webrtc';

// Define RTCIceServer locally since it's not exported from react-native-webrtc
interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Define session description/candidate init types
interface RTCSessionDescriptionInit {
  type: string;
  sdp?: string;
}

interface RTCIceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
}

import { ApiClient } from './ApiClient';
import SocketService from './SocketService';
import { PermissionsAndroid, Platform } from 'react-native';
import logger from './LoggingService';

const log = logger.createLogger('CallService');

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

export interface CallEventData {
  stream?: MediaStream;
  state?: string;
  enabled?: boolean;
  facingMode?: string;
  message?: string;
  callId?: string;
  from?: string;
  to?: string;
  callType?: 'voice' | 'video' | 'emergency';
  isEmergency?: boolean;
  caller?: {
    id: string;
    name: string;
    avatar?: string;
  };
  reason?: string;
}

export interface SignalingData {
  type: 'offer' | 'answer' | 'ice-candidate';
  sessionId: string;
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  from?: string;
  to?: string;
}

export interface IncomingCallData {
  callId: string;
  from: string;
  to: string;
  callType: 'voice' | 'video' | 'emergency';
  isEmergency: boolean;
  caller?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface CallEndData {
  reason?: string;
  callId?: string;
}

export type CallEventCallback = (data: CallEventData) => void;

export class CallService {
  private static apiClient = new ApiClient();
  private static socketService = SocketService.getInstance();
  private static peerConnection: RTCPeerConnection | null = null;
  private static localStream: MediaStream | null = null;
  private static remoteStream: MediaStream | null = null;
  private static activeCall: Call | null = null;
  private static callEventListeners: Map<string, CallEventCallback[]> = new Map();
  private static isWebRTCAvailable = false;
  private static isSpeakerEnabled = false;

  /**
   * Initialize CallService and check WebRTC availability
   */
  static async initialize(): Promise<void> {
    try {
      // Check if WebRTC is available
      this.isWebRTCAvailable = typeof RTCPeerConnection !== 'undefined';
      
      if (!this.isWebRTCAvailable) {
        log.warn('WebRTC not available - Call features will be limited');
        return;
      }
      
      // Request initial permissions
      await this.requestInitialPermissions();
      
      // Set up socket event listeners for call signaling
      this.setupSocketListeners();
      
      log.info('CallService initialized with WebRTC support');
    } catch (error) {
      log.error('CallService initialization failed', error);
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

      const config = this.getWebRTCConfig();
      this.peerConnection = new RTCPeerConnection(config);
    } catch (error) {
      log.warn('WebRTC initialization failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }

    // Handle ICE candidates
    (this.peerConnection as any).onicecandidate = (event: any) => {
      if (event.candidate && this.activeCall) {
        this.socketService.emit('call_signal', {
          type: 'ice-candidate',
          sessionId: this.activeCall.id,
          data: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          },
          to: this.getOtherParticipantId(),
        });
      }
    };

    // Handle remote stream
    (this.peerConnection as any).ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.emitCallEvent('remote_stream_received', { stream: this.remoteStream });
      }
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
    this.socketService.on('incoming_call', (data: IncomingCallData) => {
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
    this.socketService.on('call_accepted', (data: CallEventData) => {
      if (this.activeCall) {
        this.activeCall.status = 'accepted';
        this.emitCallEvent('call_accepted', data);
      }
    });

    // Call rejected
    this.socketService.on('call_rejected', (data: CallEndData) => {
      this.handleCallEnd(data);
      this.emitCallEvent('call_rejected', data);
    });

    // Call ended
    this.socketService.on('call_ended', (data: CallEndData) => {
      this.handleCallEnd(data);
      this.emitCallEvent('call_ended', data);
    });

    // WebRTC signaling
    this.socketService.on('call_signal', async (data: SignalingData) => {
      await this.handleSignalingData(data);
    });

    // Call errors
    this.socketService.on('call_error', (data: CallEventData) => {
      this.handleCallError(data.message || 'Unknown call error');
    });

    // Call initiated confirmation
    this.socketService.on('call_initiated', (data: CallEventData) => {
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
        this.localStream.getTracks().forEach((track: MediaStreamTrack) => {
          this.peerConnection!.addTrack(track, this.localStream!);
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

      // Create and send offer
      const offer = await this.peerConnection!.createOffer({});
      await this.peerConnection!.setLocalDescription(offer);
      
      // Send initiation request via socket with offer
      this.socketService.emit('call_initiate', {
        to: request.calleeId,
        callType: request.callType,
        rideId: request.rideId,
        deliveryId: request.deliveryId,
        isEmergency: request.isEmergency,
        offer: offer,
      });

      this.emitCallEvent('local_stream_received', { stream: this.localStream });
      return true;

    } catch (error: unknown) {
      log.error('Error initiating call:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      this.handleCallError(errMsg);
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
        this.localStream.getTracks().forEach((track: MediaStreamTrack) => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }

      // Accept call via socket
      this.socketService.emit('call_accept', {
        callId: this.activeCall.id,
      });

      this.emitCallEvent('local_stream_received', { stream: this.localStream });
      return true;

    } catch (error: unknown) {
      log.error('Error accepting call:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      this.handleCallError(errMsg);
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

    } catch (error: unknown) {
      log.error('Error rejecting call:', error);
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

    } catch (error: unknown) {
      log.error('Error ending call:', error);
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
   * Toggle speaker (speakerphone on/off)
   * Note: For full audio routing control, install react-native-incall-manager
   * and use InCallManager.setForceSpeakerphoneOn(enabled)
   */
  static toggleSpeaker(): boolean {
    this.isSpeakerEnabled = !this.isSpeakerEnabled;
    this.emitCallEvent('speaker_toggled', { enabled: this.isSpeakerEnabled });
    return this.isSpeakerEnabled;
  }

  /**
   * Get current speaker state
   */
  static getSpeakerEnabled(): boolean {
    return this.isSpeakerEnabled;
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

      const newStream = await mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false,
      });

      // Replace video track in peer connection
      const sender = (this.peerConnection as unknown as { getSenders(): { track: MediaStreamTrack | null; replaceTrack(track: MediaStreamTrack): Promise<void> }[] })?.getSenders().find(
        (s: { track: MediaStreamTrack | null }) => s.track && s.track.kind === 'video'
      );

      if (sender && newStream.getVideoTracks()[0]) {
        await sender.replaceTrack(newStream.getVideoTracks()[0]);

        // Update local stream
        (this.localStream as unknown as { removeTrack(t: MediaStreamTrack): void; addTrack(t: MediaStreamTrack): void }).removeTrack(videoTracks[0]);
        (this.localStream as unknown as { removeTrack(t: MediaStreamTrack): void; addTrack(t: MediaStreamTrack): void }).addTrack(newStream.getVideoTracks()[0]);
        
        this.emitCallEvent('camera_switched', { facingMode: newFacingMode });
        return true;
      }

      return false;

    } catch (error: unknown) {
      log.error('Error switching camera:', error);
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

    } catch (error: unknown) {
      log.error('Error updating call quality:', error);
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

    } catch (error: unknown) {
      log.error('Error fetching call history:', error);
      return [];
    }
  }

  /**
   * Private helper methods
   */

  private static async requestInitialPermissions(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        const micGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to your microphone for voice calls',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        const cameraGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs access to your camera for video calls',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        log.info('Permissions granted:', { microphone: micGranted, camera: cameraGranted });
      }
    } catch (error) {
      log.error('Error requesting permissions:', error);
    }
  }

  private static async requestPermissions(callType: 'voice' | 'video'): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        const micGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (!micGranted) {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        }
        
        if (callType === 'video') {
          const cameraGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
          if (!cameraGranted) {
            await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
          }
        }
      }
    } catch (error) {
      log.error('Error requesting call permissions:', error);
    }
  }

  private static async getLocalMedia(callType: 'voice' | 'video'): Promise<MediaStream> {
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: callType === 'video' ? {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: 'user',
        frameRate: { ideal: 30, max: 60 },
      } : false,
    };

    return await mediaDevices.getUserMedia(constraints as any);
  }

  private static async handleSignalingData(data: SignalingData): Promise<void> {
    try {
      if (!this.peerConnection) {
        log.warn('Received signaling data but no peer connection');
        return;
      }

      switch (data.type) {
        case 'offer':
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.data as any));
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
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.data as any));
          break;

        case 'ice-candidate': {
          const iceData = data.data as RTCIceCandidateInit;
          const candidate = new RTCIceCandidate({
            candidate: iceData.candidate,
            sdpMLineIndex: iceData.sdpMLineIndex,
            sdpMid: iceData.sdpMid,
          } as any);
          await this.peerConnection.addIceCandidate(candidate);
          break;
        }

        default:
          log.warn('Unknown signaling type:', data.type);
      }

    } catch (error: unknown) {
      log.error('Error handling signaling data:', error);
      this.handleCallError('Signaling error');
    }
  }

  private static async handleCallEnd(data: CallEndData): Promise<void> {
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
    log.error('Call error:', message);
    this.emitCallEvent('call_error', { message });
    this.cleanup();
    this.activeCall = null;
  }

  private static cleanup(): void {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
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
  static addEventListener(event: string, callback: CallEventCallback): void {
    if (!this.callEventListeners.has(event)) {
      this.callEventListeners.set(event, []);
    }
    this.callEventListeners.get(event)!.push(callback);
  }

  static removeEventListener(event: string, callback: CallEventCallback): void {
    const listeners = this.callEventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private static emitCallEvent(event: string, data: unknown): void {
    const listeners = this.callEventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data as CallEventData);
        } catch (error: unknown) {
          log.error('Error in call event listener:', error);
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

  static getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  static getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  static isInCall(): boolean {
    return this.activeCall !== null && this.activeCall.status !== 'ended';
  }
}

export default CallService;