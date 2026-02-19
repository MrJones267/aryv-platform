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
  const dispatch = useAppDispatch();
  const { profile: user } = useAppSelector((state) => state.user);
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { isDark, toggleTheme } = useAppTheme();
  
  const [isLoading, setIsLoading] = useState(false);
  const [currencyRegionText, setCurrencyRegionText] = useState('Loading...');
  const [settings, setSettings] = useState({
    notifications: true,
    locationSharing: true,
    autoAcceptRides: false,
    pushNotifications: true,
  });

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
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(logoutUser()).unwrap();
            } catch (error: unknown) {
              const errMsg = error instanceof Error ? error.message : String(error);
              Alert.alert('Error', errMsg || 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleVehicleManagement = (): void => {
    Alert.alert(
      'Vehicle Management',
      'Choose an action:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'View Vehicles',
          onPress: () => {
            // For now, show vehicles in an alert (until VehicleList screen is created)
            const vehicles = user?.vehicles || [];
            if (vehicles.length === 0) {
              Alert.alert('No Vehicles', 'You have no registered vehicles.');
            } else {
              const vehicleList = vehicles.map(v => `${v.year} ${v.make} ${v.model} (${v.licensePlate})`).join('\n');
              Alert.alert('Your Vehicles', vehicleList);
            }
          },
        },
        {
          text: 'Add Vehicle',
          onPress: () => {
            // Navigate to vehicle registration or show form
            Alert.alert('Add Vehicle', 'Vehicle registration form will open here.');
          },
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
        Alert.alert('Role Switched', `Your active role is now: ${role}`);
      },
    }));

    Alert.alert(
      'Switch Role',
      `Current role: ${user.primaryRole}. Select a new primary role:`,
      [
        { text: 'Cancel', style: 'cancel' },
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
      case 'dataUsage':
        nav.navigate('DataUsageSettings');
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
      title: 'Account',
      items: [
        {
          id: 'editProfile',
          icon: 'edit',
          title: 'Edit Profile',
          subtitle: 'Update your personal information',
          type: 'navigation',
          action: 'editProfile',
        },
        {
          id: 'verification',
          icon: 'verified',
          title: 'Account Verification',
          subtitle: user?.isEmailVerified ? 'Verified' : 'Not verified',
          type: 'info',
          badge: user?.isEmailVerified ? 'verified' : 'pending',
        },
        {
          id: 'paymentMethods',
          icon: 'payment',
          title: 'Payment Methods',
          subtitle: 'Manage cards and payment options',
          type: 'navigation',
          action: 'paymentMethods',
        },
      ],
    });

    // Become a Driver prompt (for non-drivers)
    if (!hasRole('driver')) {
      sections.push({
        id: 'becomeDriver',
        title: 'Drive with Hitch',
        items: [
          {
            id: 'becomeDriver',
            icon: 'directions-car',
            title: 'Become a Driver',
            subtitle: 'Offer rides on routes you already travel',
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
        title: 'Driver Settings',
        items: [
          {
            id: 'vehicles',
            icon: 'drive-eta',
            title: 'My Vehicles',
            subtitle: activeVehicle 
              ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`
              : 'No vehicle registered',
            type: 'navigation',
            action: 'vehicles',
          },
          {
            id: 'driverVerification',
            icon: 'verified-user',
            title: 'Driver Verification',
            subtitle: user?.isDriverVerified ? 'Verified' : 'Pending verification',
            type: 'info',
            badge: user?.isDriverVerified ? 'verified' : 'pending',
          },
          {
            id: 'autoAccept',
            icon: 'auto-awesome',
            title: 'Auto-accept rides',
            subtitle: 'Automatically accept matching ride requests',
            type: 'switch',
            value: settings.autoAcceptRides,
          },
        ],
      });
    }

    // Courier section (only for couriers)
    if (hasRole('courier')) {
      sections.push({
        id: 'courier',
        title: 'Courier Settings',
        items: [
          {
            id: 'courierVerification',
            icon: 'local-shipping',
            title: 'Courier Verification',
            subtitle: (user as unknown as Record<string, any>)?.courierVerification?.isVerified ? 'Verified' : 'Pending verification',
            type: 'info',
            badge: (user as unknown as Record<string, any>)?.courierVerification?.isVerified ? 'verified' : 'pending',
          },
          {
            id: 'deliveryHistory',
            icon: 'history',
            title: 'Delivery History',
            subtitle: `${user?.totalDeliveries || 0} completed deliveries`,
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
        title: 'Role Management',
        items: [
          {
            id: 'switchRole',
            icon: 'swap-horiz',
            title: 'Switch Active Role',
            subtitle: `Currently: ${user.primaryRole}`,
            type: 'navigation',
            action: 'switchRole',
          },
        ],
      });
    }

    // Shared settings section
    sections.push({
      id: 'settings',
      title: 'Settings',
      items: [
        {
          id: 'locationSharing',
          icon: 'location-on',
          title: 'Location sharing',
          subtitle: 'Share location during rides',
          type: 'switch',
          value: settings.locationSharing,
        },
        {
          id: 'notifications',
          icon: 'notifications',
          title: 'Notifications',
          subtitle: 'Push notifications and alerts',
          type: 'navigation',
          action: 'notifications',
        },
        {
          id: 'privacy',
          icon: 'security',
          title: 'Privacy & Security',
          subtitle: 'Manage your privacy settings',
          type: 'navigation',
          action: 'privacy',
        },
        {
          id: 'currency',
          icon: 'attach-money',
          title: 'Currency & Region',
          subtitle: currencyRegionText,
          type: 'navigation',
          action: 'currency',
        },
        {
          id: 'security',
          icon: 'shield',
          title: 'Security Settings',
          subtitle: 'Manage account security and authentication',
          type: 'navigation',
          action: 'security',
        },
        {
          id: 'language',
          icon: 'language',
          title: 'Language & Region',
          subtitle: 'Change app language and regional settings',
          type: 'navigation',
          action: 'language',
        },
        {
          id: 'dataUsage',
          icon: 'data-usage',
          title: 'Data Usage',
          subtitle: 'Monitor and control data consumption',
          type: 'navigation',
          action: 'dataUsage',
        },
        {
          id: 'pushNotifications',
          icon: 'notifications-active',
          title: 'Push notifications',
          subtitle: 'Receive push notifications',
          type: 'switch',
          value: settings.pushNotifications,
        },
        {
          id: 'darkMode',
          icon: 'dark-mode',
          title: 'Dark Mode',
          subtitle: isDark ? 'On' : 'Off',
          type: 'switch',
          value: isDark,
        },
      ],
    });

    // Analytics & Insights section
    sections.push({
      id: 'analytics',
      title: 'Analytics & Insights',
      items: [
        {
          id: 'revenueAnalytics',
          icon: 'bar-chart',
          title: 'Revenue Analytics',
          subtitle: 'View earnings breakdown and trends',
          type: 'navigation',
          action: 'revenueAnalytics',
        },
        {
          id: 'aiDashboard',
          icon: 'auto-awesome',
          title: 'AI Insights',
          subtitle: 'Demand predictions and smart recommendations',
          type: 'navigation',
          action: 'aiDashboard',
        },
      ],
    });

    // Support section (always shown)
    sections.push({
      id: 'support',
      title: 'Support',
      items: [
        {
          id: 'help',
          icon: 'help',
          title: 'Help Center',
          subtitle: 'Get help and support',
          type: 'navigation',
          action: 'help',
        },
        {
          id: 'about',
          icon: 'info',
          title: 'About ARYV',
          subtitle: 'Version 1.0.0',
          type: 'navigation',
          action: 'about',
        },
        {
          id: 'terms',
          icon: 'description',
          title: 'Terms & Privacy',
          subtitle: 'Read our terms and privacy policy',
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
            firstName: user?.firstName || 'User',
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
          <Text>Loading profile...</Text>
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
          <Text style={styles.logoutText}>Sign Out</Text>
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