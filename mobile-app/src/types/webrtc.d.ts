/**
 * @fileoverview WebRTC type definitions for React Native
 * @author Oabona-Majoko
 * @created 2025-01-25
 */

// WebRTC type declarations for React Native environment
declare global {
  interface RTCIceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
  }

  interface RTCConfiguration {
    iceServers: RTCIceServer[];
    iceCandidatePoolSize?: number;
  }

  class RTCPeerConnection {
    constructor(configuration?: RTCConfiguration);
    
    localDescription: RTCSessionDescription | null;
    remoteDescription: RTCSessionDescription | null;
    
    addTrack(track: MediaStreamTrack, stream: MediaStream): RTCSender;
    removeTrack(sender: RTCSender): void;
    
    createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit>;
    createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit>;
    
    setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
    setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
    
    addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
    
    close(): void;
    
    onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
    ontrack: ((event: RTCTrackEvent) => void) | null;
    onconnectionstatechange: ((event: Event) => void) | null;
    
    connectionState: string;
  }

  interface MediaStream {
    id: string;
    active: boolean;
    getTracks(): MediaStreamTrack[];
    getAudioTracks(): MediaStreamTrack[];
    getVideoTracks(): MediaStreamTrack[];
    addTrack(track: MediaStreamTrack): void;
    removeTrack(track: MediaStreamTrack): void;
  }

  interface MediaStreamTrack {
    id: string;
    kind: string;
    label: string;
    enabled: boolean;
    muted: boolean;
    readyState: string;
    stop(): void;
    clone(): MediaStreamTrack;
  }

  interface RTCSender {
    track: MediaStreamTrack | null;
    replaceTrack(withTrack: MediaStreamTrack | null): Promise<void>;
  }

  interface RTCSessionDescription {
    type: string;
    sdp: string;
  }

  interface RTCSessionDescriptionInit {
    type: string;
    sdp: string;
  }

  interface RTCIceCandidateInit {
    candidate: string;
    sdpMLineIndex: number | null;
    sdpMid: string | null;
  }

  interface RTCPeerConnectionIceEvent {
    candidate: RTCIceCandidate | null;
  }

  interface RTCTrackEvent {
    track: MediaStreamTrack;
    streams: MediaStream[];
  }

  interface RTCOfferOptions {
    offerToReceiveAudio?: boolean;
    offerToReceiveVideo?: boolean;
  }

  interface RTCAnswerOptions {
    // No standard options for answer
  }

  interface RTCIceCandidate {
    candidate: string;
    sdpMLineIndex: number | null;
    sdpMid: string | null;
  }
}