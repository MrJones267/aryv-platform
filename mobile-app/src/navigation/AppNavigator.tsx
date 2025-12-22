/**
 * @fileoverview Main application navigator with authentication flow
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';

import { RootState } from '../store';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import LoadingScreen from '../components/common/LoadingScreen';
import IncomingCallScreen from '../screens/call/IncomingCallScreen';
import ActiveCallScreen from '../screens/call/ActiveCallScreen';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Loading: undefined;
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

  if (isLoading) {
    return <LoadingScreen message="Initializing app..." />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          {/* Call screens - modal presentation */}
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
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;