/**
 * @fileoverview Application state slice for global app settings
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Types
export interface NotificationSettings {
  pushNotifications: boolean;
  rideUpdates: boolean;
  messages: boolean;
  promotions: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface OnboardingProgress {
  completedSteps: string[];
  currentStep: string | null;
  userRole: 'passenger' | 'driver' | 'courier' | null;
  tutorialCompleted: boolean;
  profileCompleted: boolean;
  permissionsGranted: boolean;
}

export interface AppState {
  isOnboarded: boolean;
  onboardingProgress: OnboardingProgress;
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'es' | 'fr';
  notificationSettings: NotificationSettings;
  isLoadingOverlayVisible: boolean;
  networkStatus: 'online' | 'offline';
  appVersion: string;
  buildNumber: string;
  lastAppUpdate: string | null;
  crashReportingEnabled: boolean;
  analyticsEnabled: boolean;
  locationTrackingEnabled: boolean;
  autoBackupEnabled: boolean;
  dataUsageOptimized: boolean;
}

// Initial state
const initialState: AppState = {
  isOnboarded: false,
  onboardingProgress: {
    completedSteps: [],
    currentStep: null,
    userRole: null,
    tutorialCompleted: false,
    profileCompleted: false,
    permissionsGranted: false,
  },
  theme: 'system',
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
};

// App slice
const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setOnboarded: (state, action: PayloadAction<boolean>) => {
      state.isOnboarded = action.payload;
      if (action.payload) {
        state.onboardingProgress.tutorialCompleted = true;
      }
    },
    updateOnboardingProgress: (state, action: PayloadAction<Partial<OnboardingProgress>>) => {
      state.onboardingProgress = {
        ...state.onboardingProgress,
        ...action.payload,
      };
    },
    completeOnboardingStep: (state, action: PayloadAction<string>) => {
      const step = action.payload;
      if (!state.onboardingProgress.completedSteps.includes(step)) {
        state.onboardingProgress.completedSteps.push(step);
      }
    },
    setOnboardingUserRole: (state, action: PayloadAction<'passenger' | 'driver' | 'courier'>) => {
      state.onboardingProgress.userRole = action.payload;
    },
    resetOnboardingProgress: (state) => {
      state.onboardingProgress = {
        completedSteps: [],
        currentStep: null,
        userRole: null,
        tutorialCompleted: false,
        profileCompleted: false,
        permissionsGranted: false,
      };
      state.isOnboarded = false;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<'en' | 'es' | 'fr'>) => {
      state.language = action.payload;
    },
    setNotificationSettings: (state, action: PayloadAction<Partial<NotificationSettings>>) => {
      state.notificationSettings = {
        ...state.notificationSettings,
        ...action.payload,
      };
    },
    updateNotificationSetting: (state, action: PayloadAction<{ key: keyof NotificationSettings; value: boolean }>) => {
      const { key, value } = action.payload;
      state.notificationSettings[key] = value;
    },
    toggleLoadingOverlay: (state, action: PayloadAction<boolean>) => {
      state.isLoadingOverlayVisible = action.payload;
    },
    setNetworkStatus: (state, action: PayloadAction<'online' | 'offline'>) => {
      state.networkStatus = action.payload;
    },
    setAppVersion: (state, action: PayloadAction<{ version: string; buildNumber: string }>) => {
      state.appVersion = action.payload.version;
      state.buildNumber = action.payload.buildNumber;
    },
    setLastAppUpdate: (state, action: PayloadAction<string>) => {
      state.lastAppUpdate = action.payload;
    },
    setCrashReportingEnabled: (state, action: PayloadAction<boolean>) => {
      state.crashReportingEnabled = action.payload;
    },
    setAnalyticsEnabled: (state, action: PayloadAction<boolean>) => {
      state.analyticsEnabled = action.payload;
    },
    setLocationTrackingEnabled: (state, action: PayloadAction<boolean>) => {
      state.locationTrackingEnabled = action.payload;
    },
    setAutoBackupEnabled: (state, action: PayloadAction<boolean>) => {
      state.autoBackupEnabled = action.payload;
    },
    setDataUsageOptimized: (state, action: PayloadAction<boolean>) => {
      state.dataUsageOptimized = action.payload;
    },
    resetAppSettings: (state) => {
      // Reset all settings except onboarding status
      const { isOnboarded } = state;
      Object.assign(state, {
        ...initialState,
        isOnboarded,
      });
    },
    updateAppSettings: (state, action: PayloadAction<Partial<AppState>>) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setOnboarded,
  updateOnboardingProgress,
  completeOnboardingStep,
  setOnboardingUserRole,
  resetOnboardingProgress,
  setTheme,
  setLanguage,
  setNotificationSettings,
  updateNotificationSetting,
  toggleLoadingOverlay,
  setNetworkStatus,
  setAppVersion,
  setLastAppUpdate,
  setCrashReportingEnabled,
  setAnalyticsEnabled,
  setLocationTrackingEnabled,
  setAutoBackupEnabled,
  setDataUsageOptimized,
  resetAppSettings,
  updateAppSettings,
} = appSlice.actions;

export default appSlice;