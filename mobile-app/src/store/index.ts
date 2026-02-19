/**
 * @fileoverview Redux store configuration with Redux Toolkit
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from '@reduxjs/toolkit';

// Slice imports
import authSlice, { AuthState } from './slices/authSlice';
import userSlice, { UserState } from './slices/userSlice';
import ridesSlice, { RidesState } from './slices/ridesSlice';
import locationSlice, { LocationState } from './slices/locationSlice';
import appSlice, { AppState } from './slices/appSlice';
import packageSlice, { PackageState } from './slices/packageSlice';
import courierSlice, { CourierState } from './slices/courierSlice';

// Persist configuration
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'user', 'courier'], // Persist auth, user, and courier data
  blacklist: ['rides', 'location', 'app', 'package'], // Don't persist temporary data
};

// Root reducer
const rootReducer = combineReducers({
  auth: authSlice.reducer,
  user: userSlice.reducer,
  rides: ridesSlice.reducer,
  location: locationSlice.reducer,
  app: appSlice.reducer,
  package: packageSlice.reducer,
  courier: courierSlice.reducer,
});

// Persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/PAUSE',
          'persist/PURGE',
          'persist/REGISTER',
          'persist/FLUSH',
        ],
        ignoredActionsPaths: ['payload.timestamp'],
        ignoredPaths: ['_persist'],
        // Reduce serializable check timeout for better performance
        warnAfter: __DEV__ ? 128 : 256,
      },
      // Reduce immutability check timeout for better performance
      immutableCheck: {
        warnAfter: __DEV__ ? 64 : 128,
      },
    }),
  devTools: __DEV__, // Enable Redux DevTools in development
});

// Create persistor
export const persistor = persistStore(store);

// Define RootState interface
export interface RootState {
  auth: AuthState;
  user: UserState;
  rides: RidesState;
  location: LocationState;
  app: AppState;
  package: PackageState;
  courier: CourierState;
  _persist?: {
    version: number;
    rehydrated: boolean;
  };
}

export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

// Export store actions
export const {
  logout,
  setAuthLoading,
  setTokens,
  clearAuthError,
  incrementLoginAttempts,
  resetLoginAttempts,
} = authSlice.actions;

export const {
  setUser,
  updateUser,
  clearUser,
} = userSlice.actions;

export const {
  setRides,
  addRide,
  updateRide,
  removeRide,
  setRidesLoading,
  setRidesError,
  clearRides,
} = ridesSlice.actions;

export const {
  setCurrentLocation,
  setDestination,
  setLocationPermission,
  setLocationLoading,
  clearLocation,
} = locationSlice.actions;

export const {
  setOnboarded,
  setTheme,
  setLanguage,
  setNotificationSettings,
  toggleLoadingOverlay,
} = appSlice.actions;