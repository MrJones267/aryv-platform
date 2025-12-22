/**
 * @fileoverview Courier stack navigator for package and delivery screens
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import PackageScreen from '../screens/courier/PackageScreen';
import CourierScreen from '../screens/courier/CourierScreen';
import CreatePackageScreen from '../screens/courier/CreatePackageScreen';
import PackageDetailsScreen from '../screens/courier/PackageDetailsScreen';
import DeliveryDetailsScreen from '../screens/courier/DeliveryDetailsScreen';
import PackageTrackingScreen from '../screens/courier/PackageTrackingScreen';
import QRScannerScreen from '../screens/courier/QRScannerScreen';
import { colors } from '../theme';

export type CourierStackParamList = {
  PackageMain: undefined;
  CourierMain: undefined;
  CreatePackage: undefined;
  PackageDetails: { packageId: string };
  DeliveryDetails: { agreementId: string };
  PackageTracking: { packageId: string };
  QRScanner: { agreementId?: string };
};

const Stack = createStackNavigator<CourierStackParamList>();

export const PackageNavigator: React.FC = () => {
  return (
    <Stack.Navigator
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
      <Stack.Screen 
        name="PackageMain" 
        component={PackageScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="CreatePackage" 
        component={CreatePackageScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="PackageDetails" 
        component={PackageDetailsScreen}
        options={{ title: 'Package Details' }}
      />
      <Stack.Screen 
        name="PackageTracking" 
        component={PackageTrackingScreen}
        options={{ title: 'Track Package' }}
      />
    </Stack.Navigator>
  );
};

export const CourierNavigator: React.FC = () => {
  return (
    <Stack.Navigator
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
      <Stack.Screen 
        name="CourierMain" 
        component={CourierScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="DeliveryDetails" 
        component={DeliveryDetailsScreen}
        options={{ title: 'Delivery Details' }}
      />
      <Stack.Screen 
        name="PackageTracking" 
        component={PackageTrackingScreen}
        options={{ title: 'Package Details' }}
      />
      <Stack.Screen 
        name="QRScanner" 
        component={QRScannerScreen}
        options={{ title: 'Scan QR Code' }}
      />
    </Stack.Navigator>
  );
};