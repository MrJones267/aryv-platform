/**
 * @fileoverview Onboarding permissions screen for requesting necessary permissions
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button, Card } from '../../components/ui';
import locationService from '../../services/LocationService';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateOnboardingProgress, completeOnboardingStep, setOnboarded } from '../../store/slices/appSlice';
import logger from '../../services/LoggingService';

const log = logger.createLogger('OnboardingPermissionsScreen');

interface OnboardingPermissionsScreenProps {
  navigation?: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
  route?: {
    params?: {
      selectedRole?: 'passenger' | 'driver' | 'courier';
    };
  };
}

interface Permission {
  id: string;
  title: string;
  description: string;
  icon: string;
  required: boolean;
  granted: boolean;
}

const OnboardingPermissionsScreen: React.FC<OnboardingPermissionsScreenProps> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const { onboardingProgress } = useAppSelector((state) => state.app);
  const selectedRole = route?.params?.selectedRole || onboardingProgress.userRole || 'passenger';
  
  // Define role-specific permissions
  const getRolePermissions = () => {
    const basePermissions = [
      {
        id: 'location',
        title: 'Location Access',
        description: 'Find nearby rides and provide accurate pickup locations',
        icon: 'location-on',
        required: true,
        granted: false,
      },
      {
        id: 'notifications',
        title: 'Push Notifications',
        description: 'Get real-time updates about your rides and messages',
        icon: 'notifications',
        required: false,
        granted: false,
      },
    ];
    
    const roleSpecificPermissions = selectedRole === 'driver' || selectedRole === 'courier' ? [
      {
        id: 'camera',
        title: 'Camera Access',
        description: 'Take photos for identity verification and trip documentation',
        icon: 'camera-alt',
        required: true,
        granted: false,
      },
      {
        id: 'contacts',
        title: 'Contacts Access',
        description: 'Share ride details with your emergency contacts',
        icon: 'contacts',
        required: false,
        granted: false,
      },
    ] : [];
    
    return [...basePermissions, ...roleSpecificPermissions];
  };
  const [permissions, setPermissions] = useState<Permission[]>(getRolePermissions());
  
  useEffect(() => {
    // Update permissions based on role
    setPermissions(getRolePermissions());
  }, [selectedRole]);
  
  const [isCompleting, setIsCompleting] = useState(false);
  

  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = async (permissionId: string) => {
    setIsRequesting(true);
    
    try {
      let granted = false;
      
      switch (permissionId) {
        case 'location':
          granted = await locationService.requestLocationPermission();
          if (granted) {
            // Test location access
            try {
              await locationService.getCurrentLocation();
            } catch (error) {
              log.warn('Location access granted but unable to get location:', error);
            }
          }
          break;
          
        case 'notifications':
          // In a real app, you would request notification permissions here
          // For now, we'll simulate granting the permission
          granted = true;
          break;
          
        case 'camera':
          // Request camera permission for drivers/couriers
          // In a real app, you would use PermissionsAndroid or react-native-permissions
          granted = true;
          break;
          
        case 'contacts':
          // Request contacts permission
          granted = true;
          break;
      }

      setPermissions(prev =>
        prev.map(p =>
          p.id === permissionId ? { ...p, granted } : p
        )
      );

      if (!granted && permissions.find(p => p.id === permissionId)?.required) {
        Alert.alert(
          'Permission Required',
          'This permission is required for the app to function properly. You can enable it later in your device settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errMsg || 'Failed to request permission');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRequestAllPermissions = async () => {
    const ungrantedPermissions = permissions.filter(p => !p.granted);
    
    for (const permission of ungrantedPermissions) {
      await handleRequestPermission(permission.id);
    }
  };

  const completeOnboarding = () => {
    dispatch(completeOnboardingStep('permissions'));
    dispatch(setOnboarded(true));
    // AppNavigator will automatically show MainTab when isAuthenticated is true
    // No explicit navigation needed — the auth state drives the navigator
  };

  const handleContinue = async () => {
    setIsCompleting(true);

    try {
      const requiredPermissionsGranted = permissions
        .filter(p => p.required)
        .every(p => p.granted);

      dispatch(updateOnboardingProgress({
        permissionsGranted: requiredPermissionsGranted,
        currentStep: 'complete',
      }));

      if (!requiredPermissionsGranted) {
        Alert.alert(
          'Required Permissions',
          'Some required permissions are not granted. The app may not work properly. Continue anyway?',
          [
            { text: 'Go Back', style: 'cancel' },
            { text: 'Continue', onPress: completeOnboarding },
          ]
        );
      } else {
        completeOnboarding();
      }
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Permissions?',
      'You can set up permissions later in the app settings. Some features may not work without proper permissions.',
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => {
            dispatch(updateOnboardingProgress({
              permissionsGranted: false,
              currentStep: 'complete',
            }));
            dispatch(completeOnboardingStep('permissions_skipped'));
            dispatch(setOnboarded(true));
          }
        },
      ]
    );
  };

  const allRequiredPermissionsGranted = permissions
    .filter(p => p.required)
    .every(p => p.granted);

  const allPermissionsGranted = permissions.every(p => p.granted);

  const renderPermissionCard = (permission: Permission) => (
    <Card key={permission.id} style={styles.permissionCard}>
      <View style={styles.permissionContent}>
        <View style={styles.permissionLeft}>
          <View style={[
            styles.permissionIcon,
            permission.granted && styles.permissionIconGranted
          ]}>
            <Icon
              name={permission.granted ? 'check' : permission.icon}
              size={24}
              color={permission.granted ? '#4CAF50' : '#666666'}
            />
          </View>
          <View style={styles.permissionText}>
            <View style={styles.permissionTitleRow}>
              <Text style={styles.permissionTitle}>{permission.title}</Text>
              {permission.required && (
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredText}>Required</Text>
                </View>
              )}
            </View>
            <Text style={styles.permissionDescription}>
              {permission.description}
            </Text>
          </View>
        </View>
        
        {!permission.granted && (
          <Button
            title="Allow"
            onPress={() => handleRequestPermission(permission.id)}
            disabled={isRequesting}
            variant="outline"
            size="small"
          />
        )}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Icon name="security" size={48} color="#2196F3" />
          </View>
          <Text style={styles.title}>App Permissions</Text>
          <Text style={styles.subtitle}>
            ARYV needs a few permissions to provide you with the best experience
          </Text>
        </View>

        {/* Permissions List */}
        <View style={styles.permissionsList}>
          {permissions.map(renderPermissionCard)}
        </View>

        {/* Grant All Button */}
        {!allPermissionsGranted && (
          <View style={styles.grantAllContainer}>
            <Button
              title="Allow All Permissions"
              onPress={handleRequestAllPermissions}
              disabled={isRequesting}
              loading={isRequesting}
              variant="primary"
              size="medium"
              icon="check-circle"
              fullWidth
            />
          </View>
        )}

        {/* Status Message */}
        <View style={styles.statusContainer}>
          {allPermissionsGranted ? (
            <View style={styles.statusMessage}>
              <Icon name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.statusTextSuccess}>
                All permissions granted! You're ready to go.
              </Text>
            </View>
          ) : allRequiredPermissionsGranted ? (
            <View style={styles.statusMessage}>
              <Icon name="info" size={20} color="#2196F3" />
              <Text style={styles.statusText}>
                Required permissions granted. Optional permissions can be enabled later.
              </Text>
            </View>
          ) : (
            <View style={styles.statusMessage}>
              <Icon name="warning" size={20} color="#FF9800" />
              <Text style={styles.statusTextWarning}>
                Some required permissions are missing. The app may not work properly.
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Continue"
            onPress={handleContinue}
            variant="primary"
            size="large"
            icon="arrow-forward"
            iconPosition="right"
            fullWidth
            style={styles.continueButton}
          />
          
          <Button
            title="Skip Setup"
            onPress={handleSkip}
            variant="ghost"
            size="medium"
            style={styles.skipButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  permissionsList: {
    flex: 1,
    gap: 16,
    paddingVertical: 16,
  },
  permissionCard: {
    padding: 20,
  },
  permissionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permissionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionIconGranted: {
    backgroundColor: '#E8F5E8',
  },
  permissionText: {
    flex: 1,
  },
  permissionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  requiredBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FF9800',
    textTransform: 'uppercase',
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  grantAllContainer: {
    paddingVertical: 16,
  },
  statusContainer: {
    paddingVertical: 16,
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
  },
  statusTextSuccess: {
    flex: 1,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    lineHeight: 18,
  },
  statusTextWarning: {
    flex: 1,
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
    lineHeight: 18,
  },
  actions: {
    paddingVertical: 24,
    gap: 16,
  },
  continueButton: {
    marginBottom: 8,
  },
  skipButton: {
    alignSelf: 'center',
  },
});

export default OnboardingPermissionsScreen;