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
import { logout } from '../../store/slices/authSlice';
import { fetchUserProfile } from '../../store/slices/userSlice';
import { ProfileScreenProps } from '../../navigation/types';

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
  
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    notifications: true,
    locationSharing: true,
    autoAcceptRides: false,
    pushNotifications: true,
  });

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async (): Promise<void> => {
    if (!user) {
      setIsLoading(true);
      try {
        await dispatch(fetchUserProfile()).unwrap();
      } catch (error) {
        console.log('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
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
              await dispatch(logout());
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleSettingToggle = (settingKey: keyof typeof settings): void => {
    setSettings(prev => ({ ...prev, [settingKey]: !prev[settingKey] }));
  };

  const handleMenuItemPress = (item: ProfileMenuItem): void => {
    switch (item.action) {
      case 'editProfile':
        (navigation as any).navigate('EditProfile');
        break;
      case 'paymentMethods':
        (navigation as any).navigate('PaymentMethods');
        break;
      case 'notifications':
        (navigation as any).navigate('NotificationSettings');
        break;
      case 'privacy':
        (navigation as any).navigate('PrivacySettings');
        break;
      case 'help':
        (navigation as any).navigate('Help');
        break;
      case 'about':
        (navigation as any).navigate('About');
        break;
      case 'terms':
        (navigation as any).navigate('Terms');
        break;
      case 'logout':
        handleLogout();
        break;
      default:
        console.log('Menu item pressed:', item.id);
    }
  };

  const profileSections: ProfileSection[] = [
    {
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
    },
    {
      id: 'rides',
      title: 'Ride Preferences',
      items: [
        {
          id: 'autoAccept',
          icon: 'auto-awesome',
          title: 'Auto-accept rides',
          subtitle: 'Automatically accept matching ride requests',
          type: 'switch',
          value: settings.autoAcceptRides,
        },
        {
          id: 'locationSharing',
          icon: 'location-on',
          title: 'Location sharing',
          subtitle: 'Share location during rides',
          type: 'switch',
          value: settings.locationSharing,
        },
      ],
    },
    {
      id: 'settings',
      title: 'Settings',
      items: [
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
          id: 'pushNotifications',
          icon: 'notifications-active',
          title: 'Push notifications',
          subtitle: 'Receive push notifications',
          type: 'switch',
          value: settings.pushNotifications,
        },
      ],
    },
    {
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
    },
  ];

  const renderProfileHeader = (): React.ReactNode => (
    <View style={styles.profileHeader}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.firstName?.charAt(0) || 'U'}
            {user?.lastName?.charAt(0) || ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.editAvatarButton}>
          <Icon name="camera-alt" size={16} color="#2196F3" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.userInfo}>
        <Text style={styles.userName}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.userStats}>
          <View style={styles.stat}>
            <Icon name="star" size={16} color="#FF9800" />
            <Text style={styles.statValue}>{(user as any)?.rating || '4.8'}</Text>
          </View>
          <View style={styles.statSeparator} />
          <View style={styles.stat}>
            <Icon name="drive-eta" size={16} color="#2196F3" />
            <Text style={styles.statValue}>{(user as any)?.totalRides || '0'} rides</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderMenuItem = (item: ProfileMenuItem): React.ReactNode => (
    <TouchableOpacity
      key={item.id}
      style={styles.menuItem}
      onPress={() => {
        if (item.type === 'switch') {
          handleSettingToggle(item.id as keyof typeof settings);
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
            onValueChange={() => handleSettingToggle(item.id as keyof typeof settings)}
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