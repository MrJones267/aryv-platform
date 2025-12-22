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
import RecommendationsScreen from '../screens/ai/RecommendationsScreen';
import MessagesScreen from '../screens/main/MessagesScreen';
import ChatScreen from '../screens/main/ChatScreen';
import ConversationListScreen from '../screens/communication/ConversationListScreen';
import { PackageNavigator, CourierNavigator } from './CourierNavigator';
import ProfileScreen from '../screens/main/ProfileScreen';
import EditProfileScreen from '../screens/settings/EditProfileScreen';
import PaymentMethodsScreen from '../screens/settings/PaymentMethodsScreen';
import PaymentScreen from '../screens/payment/PaymentScreen';
import VerificationWorkflowScreen from '../screens/verification/VerificationWorkflowScreen';
import EmergencyContactsScreen from '../screens/settings/EmergencyContactsScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import PrivacySettingsScreen from '../screens/settings/PrivacySettingsScreen';
import HelpScreen from '../screens/settings/HelpScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import TermsScreen from '../screens/settings/TermsScreen';
import PerformanceDashboard from '../screens/performance/PerformanceDashboard';
import { colors } from '../theme';

export type MainTabParamList = {
  Home: undefined;
  Rides: undefined;
  Messages: undefined;
  Packages: undefined;
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
  AIRecommendations: undefined;
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
  NotificationSettings: undefined;
  PrivacySettings: undefined;
  Help: undefined;
  About: undefined;
  Terms: undefined;
  PerformanceDashboard: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createStackNavigator<HomeStackParamList>();
const MessagesStack = createStackNavigator<MessagesStackParamList>();
const ProfileStack = createStackNavigator<ProfileStackParamList>();

const HomeNavigator: React.FC = () => (
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
      options={{ title: 'Hitch', headerShown: false }}
    />
    <HomeStack.Screen 
      name="Search" 
      component={SearchScreen}
      options={{ title: 'Find Rides' }}
    />
    <HomeStack.Screen 
      name="RideDetails" 
      component={RideDetailsScreen}
      options={{ title: 'Ride Details' }}
    />
    <HomeStack.Screen 
      name="CreateRide" 
      component={CreateRideScreen}
      options={{ title: 'Create Ride', headerShown: false }}
    />
    <HomeStack.Screen 
      name="Booking" 
      component={BookingScreen}
      options={{ title: 'Book Ride' }}
    />
    <HomeStack.Screen 
      name="RideRequest" 
      component={RideRequestScreen}
      options={{ title: 'Request Ride', headerShown: false }}
    />
    <HomeStack.Screen 
      name="AIRecommendations" 
      component={RecommendationsScreen}
      options={{ title: 'AI Recommendations', headerShown: false }}
    />
  </HomeStack.Navigator>
);

const MessagesNavigator: React.FC = () => (
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
      options={{ title: 'Messages', headerShown: false }}
    />
    <MessagesStack.Screen 
      name="Chat" 
      component={ChatScreen}
      options={{ title: 'Chat' }}
    />
    <MessagesStack.Screen 
      name="ConversationList" 
      component={ConversationListScreen}
      options={{ title: 'All Conversations', headerShown: false }}
    />
  </MessagesStack.Navigator>
);

const ProfileNavigator: React.FC = () => (
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
      options={{ title: 'Profile', headerShown: false }}
    />
    <ProfileStack.Screen 
      name="EditProfile" 
      component={EditProfileScreen}
      options={{ title: 'Edit Profile', headerShown: false }}
    />
    <ProfileStack.Screen 
      name="PaymentMethods" 
      component={PaymentMethodsScreen}
      options={{ title: 'Payment Methods', headerShown: false }}
    />
    <ProfileStack.Screen 
      name="PaymentScreen" 
      component={PaymentScreen}
      options={{ title: 'Payment Center', headerShown: false }}
    />
    <ProfileStack.Screen 
      name="VerificationWorkflow" 
      component={VerificationWorkflowScreen}
      options={{ title: 'Identity Verification', headerShown: false }}
    />
    <ProfileStack.Screen 
      name="EmergencyContacts" 
      component={EmergencyContactsScreen}
      options={{ title: 'Emergency Contacts', headerShown: false }}
    />
    <ProfileStack.Screen 
      name="NotificationSettings" 
      component={NotificationSettingsScreen}
      options={{ title: 'Notifications', headerShown: false }}
    />
    <ProfileStack.Screen 
      name="PrivacySettings" 
      component={PrivacySettingsScreen}
      options={{ title: 'Privacy', headerShown: false }}
    />
    <ProfileStack.Screen 
      name="Help" 
      component={HelpScreen}
      options={{ title: 'Help & Support', headerShown: false }}
    />
    <ProfileStack.Screen 
      name="About" 
      component={AboutScreen}
      options={{ title: 'About', headerShown: false }}
    />
    <ProfileStack.Screen 
      name="Terms" 
      component={TermsScreen}
      options={{ title: 'Terms & Conditions', headerShown: false }}
    />
    <ProfileStack.Screen 
      name="PerformanceDashboard" 
      component={PerformanceDashboard}
      options={{ title: 'Performance Dashboard', headerShown: false }}
    />
  </ProfileStack.Navigator>
);

const MainTabNavigator: React.FC = () => {
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
            case 'Packages':
              iconName = 'local-shipping';
              break;
            case 'Courier':
              iconName = 'delivery-dining';
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
        options={{ title: 'Hitch', headerShown: false }}
      />
      <Tab.Screen 
        name="Rides" 
        component={RidesScreen}
        options={{ title: 'My Rides' }}
      />
      <Tab.Screen 
        name="Messages" 
        component={MessagesNavigator}
        options={{ title: 'Messages', headerShown: false }}
      />
      <Tab.Screen 
        name="Packages" 
        component={PackageNavigator}
        options={{ title: 'Send Package', headerShown: false }}
      />
      <Tab.Screen 
        name="Courier" 
        component={CourierNavigator}
        options={{ title: 'Deliver', headerShown: false }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileNavigator}
        options={{ title: 'Profile', headerShown: false }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;