/**
 * @fileoverview Profile screen for user profile management and settings
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Switch,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logoutUser } from '../../store/slices/authSlice';
import { fetchUserProfile, setPrimaryRole } from '../../store/slices/userSlice';
import { UserRole } from '../../types/user';
import { ProfileScreenProps } from '../../navigation/types';
import UserPreferencesService from '../../services/UserPreferencesService';
import { useAppTheme } from '../../contexts/ThemeContext';
import UserProfileCard from '../../components/profile/UserProfileCard';
import logger from '../../services/LoggingService';
import { useI18n } from '../../i18n/I18nContext';

const log = logger.createLogger('ProfileScreen');

interface ExtendedUserFields {
  profilePicture?: string;
  rating?: number;
  totalRides?: number;
  totalDeliveries?: number;
  memberSince?: string;
  bio?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  isIdentityVerified?: boolean;
  isDriverVerified?: boolean;
  primaryRole?: string;
}

interface ProfileSection {
  id: string;
  title: string;
  items: ProfileMenuItem[];
}

interface ProfileMenuItem {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  value?: string | boolean;
  type: 'navigation' | 'switch' | 'info';
  action?: string;
  badge?: string;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const { profile: user } = useAppSelector((state) => state.user);
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { isDark, toggleTheme } = useAppTheme();
  
  const [isLoading, setIsLoading] = useState(false);
  const [currencyRegionText, setCurrencyRegionText] = useState(t('common.loading'));
  // Auto-accept, location sharing and push switches lived here and changed
  // nothing. Notifications are set in Notification Settings, and location
  // access in the phone's own settings.
  const [settings, setSettings] = useState({ notifications: true });

  useEffect(() => {
    loadUserProfile();
    loadCurrencyRegionInfo();
  }, []);

  const loadUserProfile = async (): Promise<void> => {
    if (!user) {
      setIsLoading(true);
      try {
        await dispatch(fetchUserProfile()).unwrap();
      } catch (error) {
        log.info('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const loadCurrencyRegionInfo = async (): Promise<void> => {
    try {
      const preferencesService = UserPreferencesService.getInstance();
      const formattedText = await preferencesService.getFormattedCurrencyRegion();
      setCurrencyRegionText(formattedText);
    } catch (error) {
      log.error('Error loading currency/region info:', error);
      setCurrencyRegionText('Failed to load settings');
    }
  };

  const handleLogout = (): void => {
    Alert.alert(
      t('profile.signOut'),
      t('profile.signOutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.signOut'),
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(logoutUser()).unwrap();
            } catch (error: unknown) {
              const errMsg = error instanceof Error ? error.message : String(error);
              Alert.alert(t('common.error'), errMsg || t('profile.signOutFailed'));
            }
          },
        },
      ]
    );
  };

  const handleVehicleManagement = (): void => {
    Alert.alert(
      t('profile.vehicleManagement'),
      t('profile.chooseAction'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.viewVehicles'),
          onPress: () => {
            // For now, show vehicles in an alert (until VehicleList screen is created)
            const vehicles = user?.vehicles || [];
            if (vehicles.length === 0) {
              Alert.alert(t('profile.noVehicles'), t('profile.noVehiclesBody'));
            } else {
              const vehicleList = vehicles.map(v => `${v.year} ${v.make} ${v.model} (${v.licensePlate})`).join('\n');
              Alert.alert(t('profile.yourVehicles'), vehicleList);
            }
          },
        },
        {
          text: t('profile.addVehicle'),
          // The vehicle form lives in driver onboarding. This used to show
          // "Vehicle registration form will open here." and do nothing.
          onPress: () => (navigation as unknown as { navigate: (screen: string) => void }).navigate('DriverOnboarding'),
        },
      ]
    );
  };

  const handleRoleSwitching = (): void => {
    if (!user || !user.roles || user.roles.length <= 1) {
      return;
    }

    const roleOptions = user.roles.map(role => ({
      text: role.charAt(0).toUpperCase() + role.slice(1),
      onPress: () => {
        dispatch(setPrimaryRole(role));
        Alert.alert(t('profile.roleSwitched'), t('profile.roleSwitchedBody', { role }));
      },
    }));

    Alert.alert(
      t('profile.switchRole'),
      t('profile.switchRoleBody', { role: user.primaryRole }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        ...roleOptions,
      ]
    );
  };

  const handleSettingToggle = (settingKey: string): void => {
    if (settingKey === 'darkMode') {
      toggleTheme();
      return;
    }
    setSettings(prev => ({ ...prev, [settingKey as keyof typeof settings]: !prev[settingKey as keyof typeof settings] }));
  };

  const handleMenuItemPress = (item: ProfileMenuItem): void => {
    const nav = navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void };
    switch (item.action) {
      case 'editProfile':
        nav.navigate('EditProfile');
        break;
      case 'paymentMethods':
        nav.navigate('PaymentMethods');
        break;
      case 'notifications':
        nav.navigate('NotificationSettings');
        break;
      case 'privacy':
        nav.navigate('PrivacySettings');
        break;
      case 'currency':
        nav.navigate('CurrencySettings');
        break;
      case 'security':
        nav.navigate('SecuritySettings');
        break;
      case 'language':
        nav.navigate('LanguageSettings');
        break;
      case 'help':
        nav.navigate('Help');
        break;
      case 'about':
        nav.navigate('About');
        break;
      case 'terms':
        nav.navigate('Terms');
        break;
      case 'revenueAnalytics':
        nav.navigate('RevenueAnalytics');
        break;
      case 'aiDashboard':
        nav.navigate('AIDashboard');
        break;
      case 'vehicles':
        handleVehicleManagement();
        break;
      case 'deliveryHistory':
        nav.navigate('DeliveryHistory');
        break;
      case 'switchRole':
        handleRoleSwitching();
        break;
      case 'becomeDriver':
        nav.navigate('DriverOnboarding');
        break;
      case 'logout':
        handleLogout();
        break;
      default:
        log.info('Menu item pressed:', { itemId: item.id });
    }
  };

  // Helper function to check if user has a specific role
  const hasRole = (role: UserRole): boolean => {
    return user?.roles?.includes(role) || false;
  };

  // Helper function to get active vehicle info
  const getActiveVehicle = () => {
    return user?.vehicles?.find(vehicle => (vehicle as unknown as Record<string, unknown>).status === 'active');
  };

  // Generate profile sections based on user roles
  const getProfileSections = (): ProfileSection[] => {
    const sections: ProfileSection[] = [];

    // Account section (always shown)
    sections.push({
      id: 'account',
      title: t('profile.account'),
      items: [
        {
          id: 'editProfile',
          icon: 'edit',
          title: t('profile.editProfile'),
          subtitle: t('profile.editProfileSub'),
          type: 'navigation',
          action: 'editProfile',
        },
        {
          id: 'verification',
          icon: 'verified',
          title: t('profile.accountVerification'),
          subtitle: user?.isEmailVerified ? t('profile.verified') : t('profile.notVerified'),
          type: 'info',
          badge: user?.isEmailVerified ? 'verified' : 'pending',
        },
        {
          id: 'paymentMethods',
          icon: 'payment',
          title: t('nav.paymentMethods'),
          subtitle: t('profile.paymentMethodsSub'),
          type: 'navigation',
          action: 'paymentMethods',
        },
      ],
    });

    // Become a Driver prompt (for non-drivers)
    if (!hasRole('driver')) {
      sections.push({
        id: 'becomeDriver',
        title: t('profile.driveWith'),
        items: [
          {
            id: 'becomeDriver',
            icon: 'directions-car',
            title: t('nav.becomeDriver'),
            subtitle: t('profile.becomeDriverSub'),
            type: 'navigation',
            action: 'becomeDriver',
          },
        ],
      });
    }

    // Driver section (only for drivers)
    if (hasRole('driver')) {
      const activeVehicle = getActiveVehicle();
      sections.push({
        id: 'driver',
        title: t('profile.driverSettings'),
        items: [
          {
            id: 'vehicles',
            icon: 'drive-eta',
            title: t('profile.myVehicles'),
            subtitle: activeVehicle 
              ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`
              : t('profile.noVehicleRegistered'),
            type: 'navigation',
            action: 'vehicles',
          },
          {
            id: 'driverVerification',
            icon: 'verified-user',
            title: t('profile.driverVerification'),
            subtitle: user?.isDriverVerified ? t('profile.verified') : t('profile.pendingVerification'),
            type: 'info',
            badge: user?.isDriverVerified ? 'verified' : 'pending',
          },
        ],
      });
    }

    // Courier section (only for couriers)
    if (hasRole('courier')) {
      sections.push({
        id: 'courier',
        title: t('profile.courierSettings'),
        items: [
          {
            id: 'courierVerification',
            icon: 'local-shipping',
            title: t('profile.courierVerification'),
            subtitle: (user as unknown as Record<string, any>)?.courierVerification?.isVerified ? t('profile.verified') : t('profile.pendingVerification'),
            type: 'info',
            badge: (user as unknown as Record<string, any>)?.courierVerification?.isVerified ? 'verified' : 'pending',
          },
          {
            id: 'deliveryHistory',
            icon: 'history',
            title: t('profile.deliveryHistory'),
            subtitle: t('profile.completedDeliveries', { count: user?.totalDeliveries || 0 }),
            type: 'navigation',
            action: 'deliveryHistory',
          },
        ],
      });
    }

    // Multi-role switcher (if user has multiple roles)
    if (user && user.roles && user.roles.length > 1) {
      sections.push({
        id: 'roles',
        title: t('profile.roleManagement'),
        items: [
          {
            id: 'switchRole',
            icon: 'swap-horiz',
            title: t('profile.switchActiveRole'),
            subtitle: t('profile.currently', { role: user.primaryRole }),
            type: 'navigation',
            action: 'switchRole',
          },
        ],
      });
    }

    // Shared settings section
    sections.push({
      id: 'settings',
      title: t('profile.settings'),
      items: [
        {
          id: 'notifications',
          icon: 'notifications',
          title: t('profile.notifications'),
          subtitle: t('profile.notificationsSub'),
          type: 'navigation',
          action: 'notifications',
        },
        {
          id: 'privacy',
          icon: 'security',
          title: t('profile.privacySecurity'),
          subtitle: t('profile.privacySub'),
          type: 'navigation',
          action: 'privacy',
        },
        {
          id: 'currency',
          icon: 'attach-money',
          title: t('profile.currency'),
          subtitle: currencyRegionText,
          type: 'navigation',
          action: 'currency',
        },
        {
          id: 'security',
          icon: 'shield',
          title: t('profile.securitySettings'),
          subtitle: t('profile.securitySub'),
          type: 'navigation',
          action: 'security',
        },
        {
          id: 'language',
          icon: 'language',
          title: t('nav.languageRegion'),
          subtitle: t('profile.languageSub'),
          type: 'navigation',
          action: 'language',
        },
        {
          id: 'darkMode',
          icon: 'dark-mode',
          title: t('profile.darkMode'),
          subtitle: isDark ? t('profile.on') : t('profile.off'),
          type: 'switch',
          value: isDark,
        },
      ],
    });

    // Analytics & Insights section
    sections.push({
      id: 'analytics',
      title: t('profile.analytics'),
      items: [
        {
          id: 'revenueAnalytics',
          icon: 'bar-chart',
          title: t('nav.revenue'),
          subtitle: t('profile.revenueSub'),
          type: 'navigation',
          action: 'revenueAnalytics',
        },
        {
          id: 'aiDashboard',
          icon: 'auto-awesome',
          title: t('profile.aiInsights'),
          subtitle: t('profile.aiInsightsSub'),
          type: 'navigation',
          action: 'aiDashboard',
        },
      ],
    });

    // Support section (always shown)
    sections.push({
      id: 'support',
      title: t('profile.support'),
      items: [
        {
          id: 'help',
          icon: 'help',
          title: t('profile.helpCenter'),
          subtitle: t('profile.helpCenterSub'),
          type: 'navigation',
          action: 'help',
        },
        {
          id: 'about',
          icon: 'info',
          title: t('profile.aboutAryv'),
          subtitle: t('profile.version', { version: '1.0.0' }),
          type: 'navigation',
          action: 'about',
        },
        {
          id: 'terms',
          icon: 'description',
          title: t('profile.termsPrivacy'),
          subtitle: t('profile.termsPrivacySub'),
          type: 'navigation',
          action: 'terms',
        },
      ],
    });

    return sections;
  };

  const profileSections = getProfileSections();

  const renderProfileHeader = (): React.ReactNode => {
    const extUser = user as (typeof user & ExtendedUserFields) | undefined;
    return (
      <View style={styles.profileHeader}>
        <UserProfileCard
          user={{
            id: user?.id || '',
            firstName: user?.firstName || t('profile.user'),
            lastName: user?.lastName || '',
            profilePicture: extUser?.profilePicture,
            rating: extUser?.rating || 0,
            totalRides: extUser?.totalRides || 0,
            totalDeliveries: extUser?.totalDeliveries || 0,
            memberSince: extUser?.memberSince
              ? new Date(extUser.memberSince).getFullYear().toString()
              : undefined,
            bio: extUser?.bio,
            isEmailVerified: extUser?.isEmailVerified,
            isPhoneVerified: extUser?.isPhoneVerified,
            isIdentityVerified: extUser?.isIdentityVerified,
            isDriverVerified: extUser?.isDriverVerified,
            primaryRole: extUser?.primaryRole,
          }}
          variant="full"
          onPress={() => (navigation as unknown as { navigate: (screen: string) => void }).navigate('EditProfile')}
          showBio={true}
          showStats={true}
          showVerification={true}
        />
      </View>
    );
  };

  const renderMenuItem = (item: ProfileMenuItem): React.ReactNode => (
    <TouchableOpacity
      key={item.id}
      style={styles.menuItem}
      onPress={() => {
        if (item.type === 'switch') {
          handleSettingToggle(item.id);
        } else {
          handleMenuItemPress(item);
        }
      }}
      activeOpacity={item.type === 'info' ? 1 : 0.7}
    >
      <View style={styles.menuItemLeft}>
        <View style={styles.menuIcon}>
          <Icon name={item.icon} size={22} color="#666666" />
        </View>
        <View style={styles.menuItemText}>
          <Text style={styles.menuTitle}>{item.title}</Text>
          {item.subtitle && (
            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
          )}
        </View>
      </View>

      <View style={styles.menuItemRight}>
        {item.badge && (
          <View style={[
            styles.badge,
            item.badge === 'verified' ? styles.verifiedBadge : styles.pendingBadge
          ]}>
            <Text style={[
              styles.badgeText,
              item.badge === 'verified' ? styles.verifiedBadgeText : styles.pendingBadgeText
            ]}>
              {item.badge}
            </Text>
          </View>
        )}
        {item.type === 'switch' && (
          <Switch
            value={item.value as boolean}
            onValueChange={() => handleSettingToggle(item.id)}
            trackColor={{ false: '#E0E0E0', true: '#2196F3' }}
            thumbColor="#FFFFFF"
          />
        )}
        {item.type === 'navigation' && (
          <Icon name="chevron-right" size={24} color="#CCCCCC" />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (section: ProfileSection): React.ReactNode => (
    <View key={section.id} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.sectionContent}>
        {section.items.map(renderMenuItem)}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>{t('profile.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderProfileHeader()}
        
        {profileSections.map(renderSection)}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Icon name="logout" size={20} color="#F44336" />
          <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userInfo: {
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  userEmail: {
    fontSize: 16,
    color: '#666666',
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  statSeparator: {
    width: 1,
    height: 16,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedBadge: {
    backgroundColor: '#E8F5E8',
  },
  pendingBadge: {
    backgroundColor: '#FFF3E0',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  verifiedBadgeText: {
    color: '#4CAF50',
  },
  pendingBadgeText: {
    color: '#FF9800',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default ProfileScreen;