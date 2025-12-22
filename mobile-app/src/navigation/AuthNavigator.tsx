/**
 * @fileoverview Authentication flow navigator
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import VerificationScreen from '../screens/auth/VerificationScreen';
import OnboardingWelcomeScreen from '../screens/onboarding/OnboardingWelcomeScreen';
import OnboardingPermissionsScreen from '../screens/onboarding/OnboardingPermissionsScreen';
import OnboardingProfileScreen from '../screens/onboarding/OnboardingProfileScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Verification: {
    email: string;
    type: 'email' | 'phone';
  };
  OnboardingWelcome: undefined;
  OnboardingPermissions: undefined;
  OnboardingProfile: undefined;
};

const Stack = createStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#FFFFFF' },
        animationEnabled: true,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen 
        name="Welcome" 
        component={WelcomeScreen}
        options={{
          animationTypeForReplace: 'push',
        }}
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen}
        options={{
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen 
        name="ForgotPassword" 
        component={ForgotPasswordScreen}
        options={{
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen 
        name="Verification" 
        component={VerificationScreen}
        options={{
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen 
        name="OnboardingWelcome" 
        component={OnboardingWelcomeScreen}
        options={{
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen 
        name="OnboardingPermissions" 
        component={OnboardingPermissionsScreen}
        options={{
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen 
        name="OnboardingProfile" 
        component={OnboardingProfileScreen}
        options={{
          gestureDirection: 'horizontal',
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;