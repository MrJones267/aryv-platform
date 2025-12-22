/**
 * @fileoverview Navigation type definitions
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, RouteProp } from '@react-navigation/native';

// Import parameter lists
import { RootStackParamList } from './AppNavigator';
import { AuthStackParamList } from './AuthNavigator';
import { MainTabParamList, HomeStackParamList, MessagesStackParamList } from './MainTabNavigator';

// Root navigation props
export type RootNavigationProp = StackNavigationProp<RootStackParamList>;

// Auth navigation props
export type AuthNavigationProp = StackNavigationProp<AuthStackParamList>;

// Main tab navigation props
export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;

// Home stack navigation props
export type HomeStackNavigationProp = CompositeNavigationProp<
  StackNavigationProp<HomeStackParamList>,
  MainTabNavigationProp
>;

// Messages stack navigation props
export type MessagesStackNavigationProp = CompositeNavigationProp<
  StackNavigationProp<MessagesStackParamList>,
  MainTabNavigationProp
>;

// Screen-specific navigation props
export type WelcomeScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Welcome'>;
export type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;
export type RegisterScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;

export type HomeScreenNavigationProp = StackNavigationProp<HomeStackParamList, keyof HomeStackParamList>;
export type RideDetailsScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'RideDetails'>;

// Call screen navigation props
export type IncomingCallScreenNavigationProp = StackNavigationProp<RootStackParamList, 'IncomingCall'>;
export type ActiveCallScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ActiveCall'>;

// Route props
export type VerificationScreenRouteProp = RouteProp<AuthStackParamList, 'Verification'>;
export type RideDetailsScreenRouteProp = RouteProp<HomeStackParamList, 'RideDetails'>;
export type BookingScreenRouteProp = RouteProp<HomeStackParamList, 'Booking'>;
export type ChatScreenRouteProp = RouteProp<MessagesStackParamList, 'Chat'>;
export type IncomingCallScreenRouteProp = RouteProp<RootStackParamList, 'IncomingCall'>;
export type ActiveCallScreenRouteProp = RouteProp<RootStackParamList, 'ActiveCall'>;

// Combined screen props
export interface WelcomeScreenProps {
  navigation: WelcomeScreenNavigationProp;
}

export interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

export interface RegisterScreenProps {
  navigation: RegisterScreenNavigationProp;
}

export interface VerificationScreenProps {
  navigation: StackNavigationProp<AuthStackParamList, 'Verification'>;
  route: VerificationScreenRouteProp;
}

export interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export interface RideDetailsScreenProps {
  navigation: RideDetailsScreenNavigationProp;
  route: RideDetailsScreenRouteProp;
}

export interface BookingScreenProps {
  navigation: StackNavigationProp<HomeStackParamList, 'Booking'>;
  route: BookingScreenRouteProp;
}

export interface ChatScreenProps {
  navigation: StackNavigationProp<MessagesStackParamList, 'Chat'>;
  route: ChatScreenRouteProp;
}

export interface MessagesScreenProps {
  navigation: MessagesStackNavigationProp;
}

export interface ProfileScreenProps {
  navigation: MainTabNavigationProp;
}

export interface RidesScreenProps {
  navigation: MainTabNavigationProp;
}

export interface IncomingCallScreenProps {
  navigation: IncomingCallScreenNavigationProp;
  route: IncomingCallScreenRouteProp;
}

export interface ActiveCallScreenProps {
  navigation: ActiveCallScreenNavigationProp;
  route: ActiveCallScreenRouteProp;
}