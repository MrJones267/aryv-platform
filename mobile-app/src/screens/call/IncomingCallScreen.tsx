/**
 * @fileoverview Incoming call screen for voice/video calls
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Alert,
  Vibration,
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { colors } from '../../theme';
import CallService from '../../services/CallService';
import { IncomingCallScreenProps } from '../../navigation/types';

const IncomingCallScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    callId,
    sessionId,
    callType,
    from,
    caller,
    isEmergency,
  } = route.params as any;

  const [isVibrating, setIsVibrating] = useState(false);

  useEffect(() => {
    // Prevent back button from closing call screen
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true
    );

    // Start vibration pattern for incoming call
    const vibrationPattern = isEmergency ? [0, 300, 100, 300] : [0, 1000, 1000];
    const vibrationInterval = setInterval(() => {
      if (!isVibrating) {
        Vibration.vibrate(vibrationPattern);
        setIsVibrating(true);
        
        setTimeout(() => {
          setIsVibrating(false);
        }, 2000);
      }
    }, 3000);

    // Auto-reject call after 30 seconds
    const autoRejectTimer = setTimeout(() => {
      handleRejectCall('timeout');
    }, 30000);

    return () => {
      backHandler.remove();
      clearInterval(vibrationInterval);
      clearTimeout(autoRejectTimer);
      Vibration.cancel();
    };
  }, [isEmergency]);

  const handleAcceptCall = async (): Promise<void> => {
    try {
      Vibration.cancel();
      
      const success = await CallService.acceptCall();
      
      if (success) {
        // Navigate to active call screen
        (navigation as any).replace('ActiveCall', {
          callId,
          callType,
          isIncoming: true,
        });
      } else {
        Alert.alert(
          'Call Failed',
          'Unable to accept the call. Please try again.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert(
        'Call Error',
        'Something went wrong while accepting the call.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const handleRejectCall = async (reason: string = 'declined'): Promise<void> => {
    try {
      Vibration.cancel();
      
      await CallService.rejectCall(reason);
      
      // Navigate back
      navigation.goBack();
    } catch (error) {
      console.error('Error rejecting call:', error);
      navigation.goBack();
    }
  };

  const getCallTypeIcon = (): string => {
    switch (callType) {
      case 'video':
        return 'videocam';
      case 'voice':
        return 'phone';
      case 'emergency':
        return 'emergency';
      default:
        return 'phone';
    }
  };

  const getCallTypeText = (): string => {
    if (isEmergency) return 'Emergency Call';
    switch (callType) {
      case 'video':
        return 'Video Call';
      case 'voice':
        return 'Voice Call';
      default:
        return 'Incoming Call';
    }
  };

  return (
    <View style={[styles.container, isEmergency && styles.emergencyContainer]}>
      <ImageBackground
        source={{ uri: caller?.avatar || 'https://via.placeholder.com/200' }}
        style={styles.backgroundImage}
        blurRadius={10}
      >
        <View style={styles.overlay}>
          {/* Call Type Indicator */}
          <View style={styles.callTypeContainer}>
            <Icon 
              name={getCallTypeIcon()} 
              size={24} 
              color={isEmergency ? '#FF5722' : colors.primary} 
            />
            <Text style={[styles.callTypeText, isEmergency && styles.emergencyText]}>
              {getCallTypeText()}
            </Text>
          </View>

          {/* Caller Information */}
          <View style={styles.callerContainer}>
            <View style={styles.avatarContainer}>
              <ImageBackground
                source={{ uri: caller?.avatar || 'https://via.placeholder.com/200' }}
                style={styles.avatar}
                imageStyle={styles.avatarImage}
              >
                {!caller?.avatar && (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="person" size={60} color="#FFFFFF" />
                  </View>
                )}
              </ImageBackground>
              
              {isEmergency && (
                <View style={styles.emergencyBadge}>
                  <Icon name="warning" size={16} color="#FFFFFF" />
                </View>
              )}
            </View>

            <Text style={styles.callerName}>
              {caller?.name || 'Unknown Caller'}
            </Text>
            
            <Text style={styles.callerInfo}>
              {isEmergency ? 'Emergency Contact' : 'Hitch User'}
            </Text>
          </View>

          {/* Call Actions */}
          <View style={styles.actionsContainer}>
            {/* Reject Call */}
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleRejectCall('declined')}
              activeOpacity={0.8}
            >
              <Icon name="call-end" size={32} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Accept Call */}
            <TouchableOpacity
              style={[styles.acceptButton, isEmergency && styles.emergencyAcceptButton]}
              onPress={handleAcceptCall}
              activeOpacity={0.8}
            >
              <Icon 
                name={callType === 'video' ? 'videocam' : 'call'} 
                size={32} 
                color="#FFFFFF" 
              />
            </TouchableOpacity>
          </View>

          {/* Additional Options */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => {/* Handle message */}}
            >
              <Icon name="message" size={20} color="#FFFFFF" />
              <Text style={styles.optionText}>Message</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => handleRejectCall('remind_later')}
            >
              <Icon name="schedule" size={20} color="#FFFFFF" />
              <Text style={styles.optionText}>Remind Me</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  emergencyContainer: {
    backgroundColor: '#B71C1C',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  callTypeContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  callTypeText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 8,
    fontWeight: '500',
  },
  emergencyText: {
    color: '#FFCDD2',
  },
  callerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  avatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarImage: {
    borderRadius: 75,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF5722',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  callerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  callerInfo: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 40,
  },
  rejectButton: {
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
  acceptButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emergencyAcceptButton: {
    backgroundColor: '#FF9800',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  optionButton: {
    alignItems: 'center',
    opacity: 0.8,
  },
  optionText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
  },
});

export default IncomingCallScreen;