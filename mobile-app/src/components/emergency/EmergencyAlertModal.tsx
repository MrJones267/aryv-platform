/**
 * @fileoverview Emergency alert modal with panic button and options
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import EmergencyService, { EmergencyAlert } from '../../services/EmergencyServiceSimple';

interface EmergencyAlertModalProps {
  visible: boolean;
  onClose: () => void;
  onEmergencyTriggered?: (alert: EmergencyAlert) => void;
}

const { width, height } = Dimensions.get('window');

const EmergencyAlertModal: React.FC<EmergencyAlertModalProps> = ({
  visible,
  onClose,
  onEmergencyTriggered,
}) => {
  const [selectedType, setSelectedType] = useState<EmergencyAlert['type']>('panic');
  const [isTriggering, setIsTriggering] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pulseAnimation] = useState(new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
      setCountdown(null);
      setIsTriggering(false);
    }
  }, [visible]);

  useEffect(() => {
    if (countdown !== null) {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else if (countdown === 0) {
        triggerEmergency();
      }
    }
  }, [countdown]);

  const startPulseAnimation = (): void => {
    const pulse = Animated.sequence([
      Animated.timing(pulseAnimation, {
        toValue: 1.1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]);

    Animated.loop(pulse).start();
  };

  const stopPulseAnimation = (): void => {
    pulseAnimation.stopAnimation();
    pulseAnimation.setValue(1);
  };

  const emergencyTypes = [
    { type: 'panic' as const, label: 'General Emergency', icon: 'warning', color: '#F44336' },
    { type: 'medical' as const, label: 'Medical Emergency', icon: 'local-hospital', color: '#E91E63' },
    { type: 'accident' as const, label: 'Accident', icon: 'car-crash', color: '#FF5722' },
    { type: 'harassment' as const, label: 'Harassment', icon: 'report-problem', color: '#9C27B0' },
    { type: 'other' as const, label: 'Other Emergency', icon: 'emergency', color: '#607D8B' },
  ];

  const handleEmergencyPress = (): void => {
    Alert.alert(
      '🚨 Emergency Alert',
      'This will immediately notify your emergency contacts and share your location. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Start Countdown', 
          style: 'destructive',
          onPress: startCountdown 
        },
        { 
          text: 'Emergency Now!', 
          style: 'destructive',
          onPress: () => triggerEmergency(true) 
        }
      ]
    );
  };

  const startCountdown = (): void => {
    setCountdown(5);
    setIsTriggering(true);
  };

  const cancelCountdown = (): void => {
    setCountdown(null);
    setIsTriggering(false);
  };

  const triggerEmergency = async (immediate?: boolean): Promise<void> => {
    try {
      setIsTriggering(true);
      
      if (!immediate) {
        setCountdown(null);
      }

      await EmergencyService.triggerEmergency(selectedType);
      
      if (onEmergencyTriggered) {
        const currentEmergency = EmergencyService.getCurrentEmergency();
        if (currentEmergency) {
          onEmergencyTriggered(currentEmergency);
        }
      }

      onClose();
    } catch (error) {
      console.error('Emergency trigger failed:', error);
      Alert.alert('Emergency Failed', 'Unable to trigger emergency alert. Please call emergency services directly.');
      setIsTriggering(false);
    }
  };

  const renderCountdownOverlay = (): React.ReactNode => {
    if (countdown === null) return null;

    return (
      <View style={styles.countdownOverlay}>
        <View style={styles.countdownContent}>
          <Animated.View style={[
            styles.countdownCircle,
            { transform: [{ scale: pulseAnimation }] }
          ]}>
            <Text style={styles.countdownNumber}>{countdown}</Text>
          </Animated.View>
          <Text style={styles.countdownText}>
            Emergency Alert in {countdown} second{countdown !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.countdownSubtext}>
            Your emergency contacts will be notified and your location will be shared
          </Text>
          <TouchableOpacity
            style={styles.cancelCountdownButton}
            onPress={cancelCountdown}
          >
            <Text style={styles.cancelCountdownText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmergencyType = (emergencyType: typeof emergencyTypes[0]): React.ReactNode => (
    <TouchableOpacity
      key={emergencyType.type}
      style={[
        styles.typeOption,
        selectedType === emergencyType.type && styles.selectedTypeOption,
        { borderColor: emergencyType.color }
      ]}
      onPress={() => setSelectedType(emergencyType.type)}
    >
      <Icon 
        name={emergencyType.icon} 
        size={24} 
        color={selectedType === emergencyType.type ? '#FFFFFF' : emergencyType.color} 
      />
      <Text style={[
        styles.typeLabel,
        selectedType === emergencyType.type && styles.selectedTypeLabel
      ]}>
        {emergencyType.label}
      </Text>
      {selectedType === emergencyType.type && (
        <Icon name="check-circle" size={20} color="#FFFFFF" />
      )}
    </TouchableOpacity>
  );

  const selectedEmergencyType = emergencyTypes.find(t => t.type === selectedType);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Icon name="warning" size={32} color="#F44336" />
            <Text style={styles.modalTitle}>Emergency Alert</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Icon name="close" size={24} color="#666666" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.instructionText}>
              Select emergency type and press the emergency button. Your location will be shared with emergency contacts.
            </Text>

            <View style={styles.typesContainer}>
              <Text style={styles.sectionTitle}>Emergency Type</Text>
              {emergencyTypes.map(renderEmergencyType)}
            </View>

            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => EmergencyService.callEmergencyServices()}
              >
                <Icon name="phone" size={20} color="#FFFFFF" />
                <Text style={styles.quickActionText}>Call 911</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => EmergencyService.callPrimaryContact()}
              >
                <Icon name="contacts" size={20} color="#FFFFFF" />
                <Text style={styles.quickActionText}>Call Contact</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.modalFooter}>
            <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
              <TouchableOpacity
                style={[
                  styles.emergencyButton,
                  { backgroundColor: selectedEmergencyType?.color || '#F44336' },
                  isTriggering && styles.emergencyButtonTriggering
                ]}
                onPress={handleEmergencyPress}
                disabled={isTriggering}
              >
                <Icon 
                  name={selectedEmergencyType?.icon || 'warning'} 
                  size={32} 
                  color="#FFFFFF" 
                />
                <Text style={styles.emergencyButtonText}>
                  {isTriggering ? 'TRIGGERING...' : 'EMERGENCY ALERT'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
            
            <Text style={styles.footerNote}>
              Hold and press to trigger emergency alert
            </Text>
          </View>
        </View>
      </View>

      {renderCountdownOverlay()}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: width * 0.9,
    maxHeight: height * 0.8,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    marginLeft: 12,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  typesContainer: {
    marginBottom: 20,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  selectedTypeOption: {
    backgroundColor: '#F44336',
  },
  typeLabel: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
    marginLeft: 12,
    fontWeight: '500',
  },
  selectedTypeLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#666666',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalFooter: {
    alignItems: 'center',
    padding: 20,
  },
  emergencyButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#F44336',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    marginBottom: 16,
  },
  emergencyButtonTriggering: {
    opacity: 0.7,
  },
  emergencyButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
  },
  footerNote: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownContent: {
    alignItems: 'center',
    padding: 40,
  },
  countdownCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  countdownNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  countdownText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  countdownSubtext: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  cancelCountdownButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#666666',
    borderRadius: 25,
  },
  cancelCountdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default EmergencyAlertModal;