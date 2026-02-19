/**
 * @fileoverview Main application navigator with authentication flow
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2026-02-04
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';

import { RootState } from '../store';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import LoadingScreen from '../components/common/LoadingScreen';
import RoleSelectionScreen from '../screens/onboarding/RoleSelectionScreen';
import OnboardingPermissionsScreen from '../screens/onboarding/OnboardingPermissionsScreen';
import IncomingCallScreen from '../screens/call/IncomingCallScreen';
import ActiveCallScreen from '../screens/call/ActiveCallScreen';

export type RootStackParamList = {
  Auth: undefined;
  MainTab: undefined;
  Main: undefined;
  Loading: undefined;
  Onboarding: undefined;
  OnboardingPermissions: {
    selectedRole?: 'passenger' | 'driver' | 'courier';
  };
  IncomingCall: {
    callId: string;
    sessionId: string;
    callType: 'voice' | 'video' | 'emergency';
    from: string;
    caller: {
      id: string;
      name: string;
      avatar?: string;
    };
    isEmergency: boolean;
  };
  ActiveCall: {
    callId: string;
    callType: 'voice' | 'video' | 'emergency';
    isIncoming: boolean;
  };
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);
  const { isOnboarded } = useSelector((state: RootState) => state.app);

  if (isLoading) {
    return <LoadingScreen message="Initializing app..." />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        // Not authenticated - show auth flow
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !isOnboarded ? (
        // Authenticated but not onboarded - streamlined: Role -> Permissions -> Done
        <>
          <Stack.Screen name="Onboarding" component={RoleSelectionScreen} />
          <Stack.Screen name="OnboardingPermissions" component={OnboardingPermissionsScreen} />
        </>
      ) : (
        // Authenticated and onboarded - show main app
        <>
          <Stack.Screen name="MainTab" component={MainTabNavigator} />
          <Stack.Screen
            name="IncomingCall"
            component={IncomingCallScreen}
            options={{
              presentation: 'modal',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="ActiveCall"
            component={ActiveCallScreen}
            options={{
              presentation: 'modal',
              gestureEnabled: false,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
