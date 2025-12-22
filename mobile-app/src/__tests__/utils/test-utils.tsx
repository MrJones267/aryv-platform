/**
 * @fileoverview Custom testing utilities and helpers
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore, PreloadedState } from '@reduxjs/toolkit';
import { RootState, AppStore } from '../../store';
import authSlice from '../../store/slices/authSlice';
import userSlice from '../../store/slices/userSlice';
import ridesSlice from '../../store/slices/ridesSlice';
import locationSlice from '../../store/slices/locationSlice';
import appSlice from '../../store/slices/appSlice';

// Test store setup
interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: PreloadedState<RootState>;
  store?: AppStore;
  withNavigation?: boolean;
}

export function setupStore(preloadedState?: Partial<RootState>) {
  const rootReducer = {
    auth: authSlice.reducer,
    user: userSlice.reducer,
    rides: ridesSlice.reducer,
    location: locationSlice.reducer,
    app: appSlice.reducer,
  };

  // Remove _persist property for test store setup
  const testState = preloadedState ? { ...preloadedState } : {};
  if (testState._persist) {
    delete testState._persist;
  }

  return configureStore({
    reducer: rootReducer,
    preloadedState: testState as any,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['persist/PERSIST'],
        },
      }),
  });
}

function AllTheProviders({
  children,
  store,
  withNavigation = false,
}: {
  children: React.ReactNode;
  store: AppStore;
  withNavigation?: boolean;
}) {
  const content = <Provider store={store}>{children}</Provider>;
  
  if (withNavigation) {
    return <NavigationContainer>{content}</NavigationContainer>;
  }
  
  return content;
}

// Default test state with all required properties
const defaultTestState: any = {
  auth: {
    isAuthenticated: false,
    isLoading: false,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    error: null,
    loginAttempts: 0,
    lastLoginAttempt: null,
  },
  user: {
    profile: null,
    isLoading: false,
    error: null,
    updateLoading: false,
    updateError: null,
  },
  rides: {
    searchResults: [],
    myRides: [],
    bookings: [],
    selectedRide: null,
    isLoading: false,
    searchLoading: false,
    bookingLoading: false,
    error: null,
    searchFilters: {
      passengers: 1,
      maxDistance: 10,
    },
  },
  location: {
    currentLocation: null,
    destination: null,
    hasLocationPermission: false,
    isLoadingLocation: false,
    isWatchingLocation: false,
    watchId: null,
    locationError: null,
    lastLocationUpdate: null,
    searchHistory: [],
    favorites: [],
  },
  app: {
    isOnboarded: false,
    theme: 'light',
    language: 'en',
    notificationSettings: {
      pushNotifications: true,
      rideUpdates: true,
      messages: true,
      promotions: false,
      soundEnabled: true,
      vibrationEnabled: true,
    },
    isLoadingOverlayVisible: false,
    networkStatus: 'online',
    appVersion: '1.0.0',
    buildNumber: '1',
    lastAppUpdate: null,
    crashReportingEnabled: true,
    analyticsEnabled: true,
    locationTrackingEnabled: true,
    autoBackupEnabled: true,
    dataUsageOptimized: false,
  },
  _persist: {
    version: -1,
    rehydrated: true,
  },
};

export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState = defaultTestState,
    store = setupStore({ ...preloadedState, _persist: { version: 1, rehydrated: true } } as any),
    withNavigation = false,
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AllTheProviders store={store} withNavigation={withNavigation}>
        {children}
      </AllTheProviders>
    );
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Mock data generators
export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '+1234567890',
  rating: 4.8,
  totalRides: 25,
  emailVerified: true,
  phoneVerified: false,
  ...overrides,
});

export const createMockRide = (overrides: Partial<any> = {}) => ({
  id: 'ride-1',
  driverId: 'driver-1',
  driver: {
    id: 'driver-1',
    firstName: 'Jane',
    lastName: 'Smith',
    rating: 4.9,
    totalRides: 150,
  },
  origin: {
    latitude: 37.7749,
    longitude: -122.4194,
    address: 'San Francisco, CA',
  },
  destination: {
    latitude: 37.8044,
    longitude: -122.2712,
    address: 'Oakland, CA',
  },
  departureTime: new Date(Date.now() + 3600000).toISOString(),
  pricePerSeat: 15,
  availableSeats: 3,
  totalSeats: 4,
  status: 'confirmed',
  distance: 12.5,
  estimatedDuration: 25,
  amenities: ['WiFi', 'Phone Charger'],
  preferences: {
    smokingAllowed: false,
    petsAllowed: true,
    musicAllowed: true,
  },
  ...overrides,
});

export const createMockLocation = (overrides: Partial<any> = {}) => ({
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10,
  timestamp: Date.now(),
  address: {
    street: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    country: 'US',
    postalCode: '94105',
    fullAddress: '123 Main St, San Francisco, CA 94105, US',
  },
  ...overrides,
});

export const createMockMessage = (overrides: Partial<any> = {}) => ({
  id: 'message-1',
  senderId: 'user-1',
  receiverId: 'user-2',
  message: 'Hello, how are you?',
  type: 'text',
  timestamp: new Date().toISOString(),
  isRead: false,
  rideId: 'ride-1',
  ...overrides,
});

// Mock initial states
export const mockInitialAuthState = {
  isAuthenticated: false,
  token: null,
  refreshToken: null,
  profile: null,
  isLoading: false,
  error: null,
  loginAttempts: 0,
  isBlocked: false,
  blockUntil: null,
};

export const mockAuthenticatedState = {
  isAuthenticated: true,
  token: 'mock-jwt-token',
  refreshToken: 'mock-refresh-token',
  profile: createMockUser(),
  isLoading: false,
  error: null,
  loginAttempts: 0,
  isBlocked: false,
  blockUntil: null,
};

export const mockInitialUserState = {
  profile: null,
  preferences: {
    notifications: true,
    locationSharing: true,
    theme: 'light',
  },
  isLoading: false,
  error: null,
};

export const mockInitialRidesState = {
  myRides: [],
  searchResults: [],
  searchFilters: {
    passengers: 1,
    maxPrice: undefined,
  },
  searchLoading: false,
  searchError: null,
  isLoading: false,
  error: null,
};

export const mockInitialLocationState = {
  currentLocation: null,
  isLoading: false,
  error: null,
  permissionGranted: false,
};

// Test helpers
export const waitForNextTick = () => 
  new Promise<void>(resolve => process.nextTick(resolve));

export const flushPromises = () => 
  new Promise<void>(resolve => setTimeout(resolve, 0));

export const createMockNavigation = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  pop: jest.fn(),
  setParams: jest.fn(),
  setOptions: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  dispatch: jest.fn(),
  getState: jest.fn(),
  getId: jest.fn(() => 'mock-screen-id'),
  getParent: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
});

export const createMockRoute = (params: any = {}) => ({
  key: 'mock-route-key',
  name: 'MockScreen',
  params,
  path: undefined,
});

// Animation helpers for testing
export const mockAnimations = () => {
  jest.mock('react-native-reanimated', () => {
    const View = require('react-native').View;
    return {
      Value: jest.fn(() => ({ setValue: jest.fn() })),
      event: jest.fn(),
      add: jest.fn(),
      eq: jest.fn(),
      set: jest.fn(),
      cond: jest.fn(),
      interpolate: jest.fn(),
      View: View,
      Extrapolate: { CLAMP: jest.fn() },
      Transition: {
        Together: 'Together',
        Out: 'Out',
        In: 'In',
      },
      Easing: {
        in: jest.fn(),
        out: jest.fn(),
        inOut: jest.fn(),
      },
    };
  });
};

// Export re-exports from React Testing Library
export * from '@testing-library/react-native';