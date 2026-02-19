/**
 * @fileoverview Active call screen for voice and video calls
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect, useRef } from 'react';
import { RTCView } from 'react-native-webrtc';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  BackHandler,
  Dimensions,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { colors } from '../../theme';
import CallService, { Call, CallEventCallback } from '../../services/CallService';
import { ActiveCallScreenProps } from '../../navigation/types';
import logger from '../../services/LoggingService';

const log = logger.createLogger('ActiveCallScreen');

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ActiveCallParams {
  callId: string;
  callType: 'voice' | 'video';
  isIncoming: boolean;
}

interface CallStreamData {
  stream: { toURL: () => string } | null;
}

interface CallToggleData {
  enabled: boolean;
}

interface ConnectionStateData {
  state: string;
}

const ActiveCallScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { callId, callType, isIncoming } = route.params as ActiveCallParams;

  const [call, setCall] = useState<Call | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);
  const [isCallOnHold, setIsCallOnHold] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const callTimerRef = useRef<NodeJS.Timeout>();
  const localStreamRef = useRef<CallStreamData['stream']>(null);
  const remoteStreamRef = useRef<CallStreamData['stream']>(null);

  useEffect(() => {
    // Prevent back button from ending call accidentally
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress
    );

    // Get active call data
    const activeCall = CallService.getActiveCall();
    if (activeCall) {
      setCall(activeCall);
    }

    // Setup call event listeners
    CallService.addEventListener('call_ended', handleCallEnded as CallEventCallback);
    CallService.addEventListener('call_error', handleCallError as CallEventCallback);
    CallService.addEventListener('connection_state_changed', handleConnectionStateChanged as CallEventCallback);
    CallService.addEventListener('local_stream_received', handleLocalStreamReceived as CallEventCallback);
    CallService.addEventListener('remote_stream_received', handleRemoteStreamReceived as CallEventCallback);
    CallService.addEventListener('audio_toggled', handleAudioToggled as CallEventCallback);
    CallService.addEventListener('video_toggled', handleVideoToggled as CallEventCallback);
    CallService.addEventListener('speaker_toggled', handleSpeakerToggled as CallEventCallback);

    // Start call timer
    startCallTimer();

    return () => {
      backHandler.remove();
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      
      // Remove event listeners
      CallService.removeEventListener('call_ended', handleCallEnded as CallEventCallback);
      CallService.removeEventListener('call_error', handleCallError as CallEventCallback);
      CallService.removeEventListener('connection_state_changed', handleConnectionStateChanged as CallEventCallback);
      CallService.removeEventListener('local_stream_received', handleLocalStreamReceived as CallEventCallback);
      CallService.removeEventListener('remote_stream_received', handleRemoteStreamReceived as CallEventCallback);
      CallService.removeEventListener('audio_toggled', handleAudioToggled as CallEventCallback);
      CallService.removeEventListener('video_toggled', handleVideoToggled as CallEventCallback);
      CallService.removeEventListener('speaker_toggled', handleSpeakerToggled as CallEventCallback);
    };
  }, []);

  const handleBackPress = (): boolean => {
    // Show confirmation before ending call
    Alert.alert(
      'End Call',
      'Are you sure you want to end this call?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Call', style: 'destructive', onPress: handleEndCall },
      ]
    );
    return true;
  };

  const startCallTimer = (): void => {
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const handleCallEnded = (): void => {
    log.info('Call ended, navigating back');
    navigation.goBack();
  };

  const handleCallError = (error: unknown): void => {
    log.error('Call error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    Alert.alert(
      'Call Error',
      errMsg || 'An error occurred during the call',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  const handleConnectionStateChanged = (data: ConnectionStateData): void => {
    setConnectionStatus(data.state === 'connected' ? 'connected' : 
                      data.state === 'failed' || data.state === 'disconnected' ? 'disconnected' : 'connecting');
  };

  const handleLocalStreamReceived = (data: CallStreamData): void => {
    localStreamRef.current = data.stream;
  };

  const handleRemoteStreamReceived = (data: CallStreamData): void => {
    remoteStreamRef.current = data.stream;
    setConnectionStatus('connected');
  };

  const handleAudioToggled = (data: CallToggleData): void => {
    setIsAudioMuted(!data.enabled);
  };

  const handleVideoToggled = (data: CallToggleData): void => {
    setIsVideoEnabled(data.enabled);
  };

  const handleSpeakerToggled = (data: CallToggleData): void => {
    setIsSpeakerEnabled(data.enabled);
  };

  const handleEndCall = async (): Promise<void> => {
    try {
      await CallService.endCall('ended_by_user');
      navigation.goBack();
    } catch (error) {
      log.error('Error ending call:', error);
      navigation.goBack();
    }
  };

  const handleToggleAudio = (): void => {
    const enabled = CallService.toggleAudio();
    setIsAudioMuted(!enabled);
  };

  const handleToggleVideo = (): void => {
    if (callType === 'video') {
      const enabled = CallService.toggleVideo();
      setIsVideoEnabled(enabled);
    }
  };

  const handleToggleSpeaker = (): void => {
    const enabled = CallService.toggleSpeaker();
    setIsSpeakerEnabled(enabled);
  };

  const handleSwitchCamera = async (): Promise<void> => {
    if (callType === 'video') {
      const success = await CallService.switchCamera();
      if (!success) {
        Alert.alert('Error', 'Failed to switch camera');
      }
    }
  };

  const handleAddParticipant = (): void => {
    Alert.alert('Add Participant', 'This feature will be available in a future update');
  };

  const formatCallDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionStatusText = (): string => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return formatCallDuration(callDuration);
      case 'disconnected':
        return 'Connection lost';
      default:
        return 'Unknown';
    }
  };

  const getConnectionStatusColor = (): string => {
    switch (connectionStatus) {
      case 'connecting':
        return '#FFA500';
      case 'connected':
        return '#4CAF50';
      case 'disconnected':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Video Area */}
      {callType === 'video' && (
        <View style={styles.videoContainer}>
          {/* Remote Video */}
          <View style={styles.remoteVideo}>
            {remoteStreamRef.current ? (
              <RTCView
                style={styles.rtcView}
                streamURL={remoteStreamRef.current.toURL()}
                objectFit="cover"
              />
            ) : (
              <Text style={styles.videoPlaceholder}>
                {connectionStatus === 'connected' ? 'Remote Video' : 'Connecting...'}
              </Text>
            )}
          </View>
          
          {/* Local Video (Picture-in-Picture) */}
          {isVideoEnabled && (
            <View style={styles.localVideo}>
              {localStreamRef.current ? (
                <RTCView
                  style={styles.localRtcView}
                  streamURL={localStreamRef.current.toURL()}
                  objectFit="cover"
                  mirror={true}
                />
              ) : (
                <Text style={styles.localVideoPlaceholder}>You</Text>
              )}
              
              {/* Switch Camera Button */}
              <TouchableOpacity
                style={styles.switchCameraButton}
                onPress={handleSwitchCamera}
              >
                <Icon name="cameraswitch" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Call Information */}
      <View style={[styles.callInfoContainer, callType === 'voice' && styles.voiceCallInfo]}>
        {/* Participant Info */}
        <View style={styles.participantInfo}>
          {call?.isEmergency && (
            <View style={styles.emergencyBadge}>
              <Icon name="warning" size={16} color="#FFFFFF" />
              <Text style={styles.emergencyText}>Emergency Call</Text>
            </View>
          )}
          
          <Text style={styles.participantName}>
            {call?.caller?.name || call?.callee?.name || 'Unknown'}
          </Text>
          
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: getConnectionStatusColor() }]} />
            <Text style={styles.callStatus}>
              {getConnectionStatusText()}
            </Text>
          </View>
        </View>
      </View>

      {/* Call Controls */}
      <View style={styles.controlsContainer}>
        {/* Top Row Controls */}
        <View style={styles.topControls}>
          {/* Speaker Toggle */}
          <TouchableOpacity
            style={[styles.controlButton, isSpeakerEnabled && styles.activeControlButton]}
            onPress={handleToggleSpeaker}
          >
            <Icon 
              name={isSpeakerEnabled ? 'volume-up' : 'volume-down'} 
              size={24} 
              color={isSpeakerEnabled ? colors.primary : '#FFFFFF'} 
            />
          </TouchableOpacity>

          {/* Video Toggle (only for video calls) */}
          {callType === 'video' && (
            <TouchableOpacity
              style={[styles.controlButton, !isVideoEnabled && styles.disabledControlButton]}
              onPress={handleToggleVideo}
            >
              <Icon 
                name={isVideoEnabled ? 'videocam' : 'videocam-off'} 
                size={24} 
                color={isVideoEnabled ? '#FFFFFF' : '#F44336'} 
              />
            </TouchableOpacity>
          )}

          {/* Add Participant */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleAddParticipant}
          >
            <Icon name="person-add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Main Controls */}
        <View style={styles.mainControls}>
          {/* Audio Toggle */}
          <TouchableOpacity
            style={[styles.controlButton, isAudioMuted && styles.disabledControlButton]}
            onPress={handleToggleAudio}
          >
            <Icon 
              name={isAudioMuted ? 'mic-off' : 'mic'} 
              size={28} 
              color={isAudioMuted ? '#F44336' : '#FFFFFF'} 
            />
          </TouchableOpacity>

          {/* End Call */}
          <TouchableOpacity
            style={styles.endCallButton}
            onPress={handleEndCall}
          >
            <Icon name="call-end" size={32} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Chat */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => {/* Navigate to chat */}}
          >
            <Icon name="chat" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rtcView: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000000',
  },
  videoPlaceholder: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  localVideo: {
    position: 'absolute',
    top: 40,
    right: 16,
    width: 120,
    height: 160,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  localRtcView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  localVideoPlaceholder: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  switchCameraButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callInfoContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
  },
  voiceCallInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  participantInfo: {
    alignItems: 'center',
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  emergencyText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  participantName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  callStatus: {
    fontSize: 16,
    color: '#CCCCCC',
  },
  controlsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 40,
  },
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeControlButton: {
    backgroundColor: colors.primary,
  },
  disabledControlButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});

export default ActiveCallScreen;