/**
 * @fileoverview Main tab navigator for authenticated users
 * @author Oabona-Majoko
 * @created 2025-01-27
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

import HomeScreen from '../screens/main/HomeScreen';
import SearchScreen from '../screens/main/SearchScreen';
import RidesScreen from '../screens/main/RidesScreen';
import RideDetailsScreen from '../screens/main/RideDetailsScreen';
import CreateRideScreen from '../screens/rides/CreateRideScreen';
import BookingScreen from '../screens/rides/BookingScreen';
import RideRequestScreen from '../screens/rides/RideRequestScreen';
import RideRatingScreen from '../screens/rides/RideRatingScreen';
import RecommendationsScreen from '../screens/ai/RecommendationsScreen';
import DriverOnboardingScreen from '../screens/onboarding/DriverOnboardingScreen';
import MessagesScreen from '../screens/main/MessagesScreen';
import ChatScreen from '../screens/main/ChatScreen';
import ConversationListScreen from '../screens/communication/ConversationListScreen';
import { CourierHubNavigator } from './CourierNavigator';
import ProfileScreen from '../screens/main/ProfileScreen';
import EditProfileScreen from '../screens/settings/EditProfileScreen';
import PaymentMethodsScreen from '../screens/settings/PaymentMethodsScreen';
import PaymentScreen from '../screens/payment/PaymentScreen';
import VerificationWorkflowScreen from '../screens/verification/VerificationWorkflowScreen';
import EmergencyContactsScreen from '../screens/settings/EmergencyContactsScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import PrivacySettingsScreen from '../screens/settings/PrivacySettingsScreen';
import CurrencySettingsScreen from '../screens/settings/CurrencySettingsScreen';
import SecuritySettingsScreen from '../screens/settings/SecuritySettingsScreen';
import LanguageSettingsScreen from '../screens/settings/LanguageSettingsScreen';
import DataUsageSettingsScreen from '../screens/settings/DataUsageSettingsScreen';
import HelpScreen from '../screens/settings/HelpScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import TermsScreen from '../screens/settings/TermsScreen';
import PerformanceDashboard from '../screens/performance/PerformanceDashboard';
import RevenueAnalyticsScreen from '../screens/RevenueAnalyticsScreen';
import AIDashboardScreen from '../screens/AIDashboardScreen';
import { colors } from '../theme';
import { useI18n } from '../i18n/I18nContext';

export type MainTabParamList = {
  Home: undefined;
  Rides: undefined;
  Messages: undefined;
  Courier: undefined;
  Profile: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Search: undefined;
  RideDetails: { rideId: string };
  CreateRide: undefined;
  Booking: { rideId: string };
  RideRequest: { origin?: any; destination?: any };
  RideRating: { rideId: string; driverName?: string; origin?: string; destination?: string; role?: 'passenger' | 'driver' };
  AIRecommendations: undefined;
  DriverOnboarding: undefined;
};

export type MessagesStackParamList = {
  MessagesList: undefined;
  Chat: { chatId: string; recipientName: string; };
  ConversationList: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  PaymentMethods: undefined;
  PaymentScreen: undefined;
  VerificationWorkflow: undefined;
  EmergencyContacts: undefined;
  NotificationsInbox: undefined;
  NotificationSettings: undefined;
  PrivacySettings: undefined;
  CurrencySettings: undefined;
  SecuritySettings: undefined;
  LanguageSettings: undefined;
  DataUsageSettings: undefined;
  Help: undefined;
  About: undefined;
  Terms: undefined;
  PerformanceDashboard: undefined;
  RevenueAnalytics: undefined;
  AIDashboard: undefined;
  DriverOnboarding: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createStackNavigator<HomeStackParamList>();
const MessagesStack = createStackNavigator<MessagesStackParamList>();
const ProfileStack = createStackNavigator<ProfileStackParamList>();

const HomeNavigator: React.FC = () => {
  const { t } = useI18n();
  return (
  <HomeStack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: colors.primary,
      },
      headerTintColor: colors.text.inverse,
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    }}
  >
    <HomeStack.Screen 
      name="HomeMain" 
      component={HomeScreen}
      options={{ title: 'ARYV', headerShown: false }}
    />
    <HomeStack.Screen 
      name="Search" 
      component={SearchScreen}
      options={{ title: t('nav.findRides') }}
    />
    <HomeStack.Screen 
      name="RideDetails" 
      component={RideDetailsScreen}
      options={{ title: t('nav.rideDetails') }}
    />
    <HomeStack.Screen 
      name="CreateRide" 
      component={CreateRideScreen}
      options={{ title: t('nav.createRide'), headerShown: false }}
    />
    <HomeStack.Screen 
      name="Booking" 
      component={BookingScreen}
      options={{ title: t('nav.bookRide') }}
    />
    <HomeStack.Screen
      name="RideRequest"
      component={RideRequestScreen}
      options={{ title: t('nav.requestRide'), headerShown: false }}
    />
    <HomeStack.Screen
      name="RideRating"
      component={RideRatingScreen}
      options={{ title: t('nav.rateTrip'), headerShown: false }}
    />
    <HomeStack.Screen
      name="AIRecommendations"
      component={RecommendationsScreen}
      options={{ title: t('nav.aiRecommendations'), headerShown: false }}
    />
    <HomeStack.Screen
      name="DriverOnboarding"
      component={DriverOnboardingScreen}
      options={{ title: t('nav.becomeDriver'), headerShown: false }}
    />
    </HomeStack.Navigator>
  );
};

const MessagesNavigator: React.FC = () => {
  const { t } = useI18n();
  return (
  <MessagesStack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: colors.primary,
      },
      headerTintColor: colors.text.inverse,
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    }}
  >
    <MessagesStack.Screen 
      name="MessagesList" 
      component={MessagesScreen}
      options={{ title: t('nav.messages'), headerShown: false }}
    />
    <MessagesStack.Screen 
      name="Chat" 
      component={ChatScreen}
      options={{ title: t('nav.chat') }}
    />
    <MessagesStack.Screen 
      name="ConversationList" 
      component={ConversationListScreen}
      options={{ title: t('nav.allConversations'), headerShown: false }}
    />
    </MessagesStack.Navigator>
  );
};

const ProfileNavigator: React.FC = () => {
  const { t } = useI18n();
  return (
  <ProfileStack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: colors.primary,
      },
      headerTintColor: colors.text.inverse,
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    }}
  >
    <ProfileStack.Screen 
      name="ProfileMain" 
      component={ProfileScreen}
      options={{ title: t('nav.profile'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="EditProfile" 
      component={EditProfileScreen}
      options={{ title: t('nav.editProfile'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="PaymentMethods" 
      component={PaymentMethodsScreen}
      options={{ title: t('nav.paymentMethods'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="PaymentScreen" 
      component={PaymentScreen}
      options={{ title: t('nav.paymentCenter'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="VerificationWorkflow" 
      component={VerificationWorkflowScreen}
      options={{ title: t('nav.identityVerification'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="EmergencyContacts" 
      component={EmergencyContactsScreen}
      options={{ title: t('nav.emergencyContacts'), headerShown: false }}
    />
    <ProfileStack.Screen
      name="NotificationsInbox"
      component={NotificationsScreen}
      options={{ title: t('nav.notifications'), headerShown: false }}
    />
    <ProfileStack.Screen
      name="NotificationSettings"
      component={NotificationSettingsScreen}
      options={{ title: t('nav.notifications'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="PrivacySettings" 
      component={PrivacySettingsScreen}
      options={{ title: t('nav.privacy'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="CurrencySettings" 
      component={CurrencySettingsScreen}
      options={{ title: t('nav.currencyRegion'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="SecuritySettings" 
      component={SecuritySettingsScreen}
      options={{ title: t('nav.security'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="LanguageSettings" 
      component={LanguageSettingsScreen}
      options={{ title: t('nav.languageRegion'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="DataUsageSettings" 
      component={DataUsageSettingsScreen}
      options={{ title: t('nav.dataUsage'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="Help" 
      component={HelpScreen}
      options={{ title: t('nav.help'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="About" 
      component={AboutScreen}
      options={{ title: t('nav.about'), headerShown: false }}
    />
    <ProfileStack.Screen 
      name="Terms" 
      component={TermsScreen}
      options={{ title: t('nav.terms'), headerShown: false }}
    />
    <ProfileStack.Screen
      name="PerformanceDashboard"
      component={PerformanceDashboard}
      options={{ title: t('nav.performance'), headerShown: false }}
    />
    <ProfileStack.Screen
      name="RevenueAnalytics"
      component={RevenueAnalyticsScreen}
      options={{ title: t('nav.revenue'), headerShown: false }}
    />
    <ProfileStack.Screen
      name="AIDashboard"
      component={AIDashboardScreen}
      options={{ title: t('nav.aiDashboard'), headerShown: false }}
    />
    <ProfileStack.Screen
      name="DriverOnboarding"
      component={DriverOnboardingScreen}
      options={{ title: t('nav.becomeDriver'), headerShown: false }}
    />
    </ProfileStack.Navigator>
  );
};

const MainTabNavigator: React.FC = () => {
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = 'home';
              break;
            case 'Rides':
              iconName = 'directions-car';
              break;
            case 'Messages':
              iconName = 'message';
              break;
            case 'Courier':
              iconName = 'local-shipping';
              break;
            case 'Profile':
              iconName = 'person';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarStyle: {
          backgroundColor: colors.background.primary,
          borderTopColor: colors.border.light,
        },
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.text.inverse,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeNavigator}
        options={{ title: t('nav.home'), headerShown: false }}
      />
      <Tab.Screen 
        name="Rides" 
        component={RidesScreen}
        options={{ title: t('nav.myRides') }}
      />
      <Tab.Screen 
        name="Messages" 
        component={MessagesNavigator}
        options={{ title: t('nav.messages'), headerShown: false }}
      />
      <Tab.Screen
        name="Courier"
        component={CourierHubNavigator}
        options={{ title: t('nav.courier'), headerShown: false }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileNavigator}
        options={{ title: t('nav.profile'), headerShown: false }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;