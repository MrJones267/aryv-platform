/**
 * @fileoverview Onboarding permissions screen for requesting necessary permissions
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2026-11-03
 *
 * Every permission is now actually asked for. Notifications, camera and
 * contacts were marked "granted" without asking Android, so the screen
 * claimed permissions the app did not have. Contacts is gone: the app never
 * declares or uses it. The screen also starts from what is already allowed,
 * and offers the phone's settings for anything Android will no longer ask.
 *
 * The list scrolls and the actions stay at the bottom; on a typical phone the
 * old fixed layout pushed the buttons off screen once a driver's four cards
 * were shown.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  check,
  request,
  checkNotifications,
  requestNotifications,
  openSettings,
  PERMISSIONS,
  RESULTS,
  type Permission as NativePermission,
  type PermissionStatus,
} from 'react-native-permissions';
import { Button, Card } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateOnboardingProgress, completeOnboardingStep, setOnboarded } from '../../store/slices/appSlice';
import logger from '../../services/LoggingService';
import { useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/translations';

const log = logger.createLogger('OnboardingPermissionsScreen');

interface OnboardingPermissionsScreenProps {
  navigation?: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
  route?: {
    params?: {
      selectedRole?: 'passenger' | 'driver' | 'courier';
    };
  };
}

type PermissionId = 'location' | 'notifications' | 'camera';

interface PermissionState {
  granted: boolean;
  /** Android will not ask again; only the phone's settings can change it. */
  blocked: boolean;
}

type Translate = (key: TranslationKey) => string;

const DETAILS: Record<PermissionId, (t: Translate) => { title: string; description: string; icon: string; required: boolean }> = {
  location: (t) => ({ title: t('rf.locationAccess'), description: t('rf.findNearbyRidesAndProvide'), icon: 'location-on', required: true }),
  notifications: (t) => ({ title: t('rf.pushNotifications'), description: t('rf.getRealTimeUpdatesAbout'), icon: 'notifications', required: false }),
  camera: (t) => ({ title: t('rf.cameraAccess'), description: t('rf.takePhotosForIdentityVerification'), icon: 'camera-alt', required: true }),
};

interface Permission {
  id: PermissionId;
  title: string;
  description: string;
  icon: string;
  required: boolean;
  granted: boolean;
  /** Android will not ask again; only the phone's settings can change it. */
  blocked: boolean;
}

const NATIVE: Record<Exclude<PermissionId, 'notifications'>, NativePermission> = {
  location: Platform.OS === 'ios' ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  camera: Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA,
};

const isGranted = (status: PermissionStatus): boolean => status === RESULTS.GRANTED || status === RESULTS.LIMITED;

/** Where a permission stands right now, without asking for it. */
const statusOf = async (id: PermissionId): Promise<PermissionStatus> =>
  id === 'notifications' ? (await checkNotifications()).status : check(NATIVE[id]);

/** Ask for a permission; Android shows its dialog unless the person blocked it. */
const ask = async (id: PermissionId): Promise<PermissionStatus> =>
  id === 'notifications' ? (await requestNotifications(['alert', 'sound', 'badge'])).status : request(NATIVE[id]);

const OnboardingPermissionsScreen: React.FC<OnboardingPermissionsScreenProps> = ({ route }) => {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const { onboardingProgress } = useAppSelector((state) => state.app);
  const selectedRole = route?.params?.selectedRole || onboardingProgress.userRole || 'passenger';

  // Which permissions to show depends only on the role. Titles are looked up
  // while rendering, so a new `t` never restarts the status checks (that
  // looped: the effect set state, the render made a new `t`, and round again).
  const ids = useMemo<PermissionId[]>(
    () => (selectedRole === 'driver' || selectedRole === 'courier'
      ? ['location', 'notifications', 'camera']
      : ['location', 'notifications']),
    [selectedRole],
  );
  const [states, setStates] = useState<Partial<Record<PermissionId, PermissionState>>>({});
  const [isRequesting, setIsRequesting] = useState(false);

  const permissions: Permission[] = ids.map((id) => ({
    id,
    ...DETAILS[id](t),
    granted: states[id]?.granted ?? false,
    blocked: states[id]?.blocked ?? false,
  }));

  const record = (id: PermissionId, status: PermissionStatus): void => {
    setStates((prev) => ({ ...prev, [id]: { granted: isGranted(status), blocked: status === RESULTS.BLOCKED } }));
  };

  // Start from what the phone already allows, so nothing granted earlier is
  // shown as missing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const id of ids) {
        try {
          const status = await statusOf(id);
          if (!cancelled) {record(id, status);}
        } catch (error) {
          log.warn(`Could not check ${id} permission`, error);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [ids]);

  const requestOne = async (permission: Permission): Promise<void> => {
    if (permission.blocked) {
      Alert.alert(permission.title, t('perm.blockedBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('perm.openSettings'), onPress: () => { openSettings().catch(() => undefined); } },
      ]);
      return;
    }
    try {
      record(permission.id, await ask(permission.id));
    } catch (error: unknown) {
      log.error(`Requesting ${permission.id} failed`, error);
      Alert.alert(t('common.error'), t('rf.failedToRequestPermission'));
    }
  };

  const handleRequestPermission = async (permission: Permission): Promise<void> => {
    setIsRequesting(true);
    try {
      await requestOne(permission);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRequestAllPermissions = async (): Promise<void> => {
    setIsRequesting(true);
    try {
      // One at a time: Android shows one dialog at a time anyway, and blocked
      // ones are left for the person to open settings for deliberately.
      for (const permission of permissions.filter((p) => !p.granted && !p.blocked)) {
        await requestOne(permission);
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const completeOnboarding = (): void => {
    dispatch(completeOnboardingStep('permissions'));
    dispatch(setOnboarded(true));
    // AppNavigator shows the main tabs once onboarding is complete.
  };

  const allRequiredPermissionsGranted = permissions.filter((p) => p.required).every((p) => p.granted);
  const allPermissionsGranted = permissions.every((p) => p.granted);
  // Something Android will still show a dialog for.
  const canAskForMore = permissions.some((p) => !p.granted && !p.blocked);

  const handleContinue = (): void => {
    dispatch(updateOnboardingProgress({
      permissionsGranted: allRequiredPermissionsGranted,
      currentStep: 'complete',
    }));

    if (!allRequiredPermissionsGranted) {
      Alert.alert(
        t('rf.requiredPermissions'),
        t('rf.someRequiredPermissionsAreNot'),
        [
          { text: t('rideDetails.goBack'), style: 'cancel' },
          { text: t('verify.continue'), onPress: completeOnboarding },
        ]
      );
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = (): void => {
    Alert.alert(
      t('rf.skipPermissions'),
      t('rf.youCanSetUpPermissions'),
      [
        { text: t('rideDetails.goBack'), style: 'cancel' },
        {
          text: t('common.skip'),
          onPress: () => {
            dispatch(updateOnboardingProgress({
              permissionsGranted: false,
              currentStep: 'complete',
            }));
            dispatch(completeOnboardingStep('permissions_skipped'));
            dispatch(setOnboarded(true));
          },
        },
      ]
    );
  };

  const renderPermissionCard = (permission: Permission) => (
    <Card key={permission.id} style={styles.permissionCard}>
      <View style={styles.permissionContent}>
        <View style={[styles.permissionIcon, permission.granted && styles.permissionIconGranted]}>
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
                <Text style={styles.requiredText}>{t('rf.required')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.permissionDescription}>{permission.description}</Text>
        </View>
        {!permission.granted && (
          <View style={styles.permissionAction}>
            <Button
              title={permission.blocked ? t('perm.openSettings') : t('rf.allow')}
              onPress={() => handleRequestPermission(permission)}
              disabled={isRequesting}
              variant="outline"
              size="small"
              testID={`allow-${permission.id}`}
            />
          </View>
        )}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Icon name="security" size={40} color="#2196F3" />
          </View>
          <Text style={styles.title}>{t('rf.appPermissions')}</Text>
          <Text style={styles.subtitle}>{t('rf.aryvNeedsAFewPermissions')}</Text>
        </View>

        <View style={styles.permissionsList}>
          {permissions.map(renderPermissionCard)}
        </View>

        <View style={styles.statusMessage}>
          {allPermissionsGranted ? (
            <>
              <Icon name="check-circle" size={20} color="#4CAF50" />
              <Text style={[styles.statusText, styles.statusTextSuccess]}>{t('perm.allGranted')}</Text>
            </>
          ) : allRequiredPermissionsGranted ? (
            <>
              <Icon name="info" size={20} color="#2196F3" />
              <Text style={styles.statusText}>{t('rf.requiredPermissionsGrantedOptionalPermissions')}</Text>
            </>
          ) : (
            <>
              <Icon name="warning" size={20} color="#FF9800" />
              <Text style={[styles.statusText, styles.statusTextWarning]}>{t('rf.someRequiredPermissionsAreMissing')}</Text>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {canAskForMore ? (
          <>
            <Button
              title={t('rf.allowAllPermissions')}
              onPress={handleRequestAllPermissions}
              disabled={isRequesting}
              loading={isRequesting}
              variant="primary"
              size="large"
              icon="check-circle"
              fullWidth
            />
            <Button
              title={allRequiredPermissionsGranted ? t('verify.continue') : t('rf.skipSetup')}
              onPress={allRequiredPermissionsGranted ? handleContinue : handleSkip}
              variant="ghost"
              size="medium"
              style={styles.secondaryButton}
            />
          </>
        ) : (
          <Button
            title={t('verify.continue')}
            onPress={handleContinue}
            variant="primary"
            size="large"
            icon="arrow-forward"
            iconPosition="right"
            fullWidth
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionsList: {
    gap: 12,
  },
  permissionCard: {
    padding: 16,
  },
  permissionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionIconGranted: {
    backgroundColor: '#E8F5E8',
  },
  permissionText: {
    flex: 1,
    minWidth: 0,
  },
  permissionTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    flexShrink: 1,
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
    fontSize: 13,
    color: '#666666',
    lineHeight: 19,
  },
  permissionAction: {
    alignSelf: 'center',
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginTop: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
    lineHeight: 19,
  },
  statusTextSuccess: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  statusTextWarning: {
    color: '#FF9800',
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  secondaryButton: {
    alignSelf: 'center',
  },
});

export default OnboardingPermissionsScreen;