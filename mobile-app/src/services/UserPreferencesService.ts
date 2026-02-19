/**
 * @fileoverview User Preferences Service for managing user settings and preferences
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from './LoggingService';

const log = logger.createLogger('UserPreferencesService');

const PREFERENCES_KEY = '@aryv_user_preferences';

export interface Country {
  code: string;
  name: string;
  dialCode: string;
  currency: string;
  flag: string;
  region?: string;
}

export interface UserPreferences {
  country?: Country;
  currency?: string;
  language?: string;
  theme?: 'light' | 'dark' | 'system';
  notifications?: {
    push: boolean;
    email: boolean;
    sms: boolean;
    rideUpdates: boolean;
    promotions: boolean;
    emergencyAlerts: boolean;
  };
  privacy?: {
    locationSharing: boolean;
    profileVisibility: boolean;
    rideHistorySharing: boolean;
    contactSync: boolean;
    analytics: boolean;
  };
  dataUsage?: {
    wifiOnlyMaps: boolean;
    compressImages: boolean;
    autoPlayVideos: boolean;
    backgroundData: boolean;
    dataSaverMode: boolean;
  };
}

class UserPreferencesService {
  private static instance: UserPreferencesService;
  private preferences: UserPreferences = {};
  private listeners: Set<(preferences: UserPreferences) => void> = new Set();

  private constructor() {
    this.loadPreferences();
  }

  static getInstance(): UserPreferencesService {
    if (!UserPreferencesService.instance) {
      UserPreferencesService.instance = new UserPreferencesService();
    }
    return UserPreferencesService.instance;
  }

  /**
   * Load preferences from storage
   */
  private async loadPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        this.preferences = JSON.parse(stored);
      }
    } catch (error) {
      log.error('Failed to load preferences', error);
    }
  }

  /**
   * Save preferences to storage
   */
  private async savePreferences(): Promise<void> {
    try {
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(this.preferences));
      this.notifyListeners();
    } catch (error) {
      log.error('Failed to save preferences', error);
    }
  }

  /**
   * Get all preferences
   */
  getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  /**
   * Get user's country
   */
  getCountry(): Country | undefined {
    return this.preferences.country;
  }

  /**
   * Update user's country
   */
  async updateCountry(country: Country): Promise<void> {
    this.preferences.country = country;
    this.preferences.currency = country.currency;
    await this.savePreferences();
  }

  /**
   * Get user's currency
   */
  getCurrency(): string | undefined {
    return this.preferences.currency;
  }

  /**
   * Update user's currency
   */
  async updateCurrency(currency: string): Promise<void> {
    this.preferences.currency = currency;
    await this.savePreferences();
  }

  /**
   * Get user's language
   */
  getLanguage(): string {
    return this.preferences.language || 'en';
  }

  /**
   * Update user's language
   */
  async updateLanguage(language: string): Promise<void> {
    this.preferences.language = language;
    await this.savePreferences();
  }

  /**
   * Get user's theme
   */
  getTheme(): 'light' | 'dark' | 'system' {
    return this.preferences.theme || 'system';
  }

  /**
   * Update user's theme
   */
  async updateTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    this.preferences.theme = theme;
    await this.savePreferences();
  }

  /**
   * Get notification preferences
   */
  getNotificationPreferences(): UserPreferences['notifications'] {
    return this.preferences.notifications || {
      push: true,
      email: true,
      sms: true,
      rideUpdates: true,
      promotions: false,
      emergencyAlerts: true,
    };
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    notifications: Partial<NonNullable<UserPreferences['notifications']>>
  ): Promise<void> {
    this.preferences.notifications = {
      ...this.getNotificationPreferences()!,
      ...notifications,
    };
    await this.savePreferences();
  }

  /**
   * Get privacy preferences
   */
  getPrivacyPreferences(): UserPreferences['privacy'] {
    return this.preferences.privacy || {
      locationSharing: true,
      profileVisibility: true,
      rideHistorySharing: false,
      contactSync: false,
      analytics: true,
    };
  }

  /**
   * Update privacy preferences
   */
  async updatePrivacyPreferences(
    privacy: Partial<NonNullable<UserPreferences['privacy']>>
  ): Promise<void> {
    this.preferences.privacy = {
      ...this.getPrivacyPreferences()!,
      ...privacy,
    };
    await this.savePreferences();
  }

  /**
   * Get data usage preferences
   */
  getDataUsagePreferences(): UserPreferences['dataUsage'] {
    return this.preferences.dataUsage || {
      wifiOnlyMaps: true,
      compressImages: false,
      autoPlayVideos: false,
      backgroundData: true,
      dataSaverMode: false,
    };
  }

  /**
   * Update data usage preferences
   */
  async updateDataUsagePreferences(
    dataUsage: Partial<NonNullable<UserPreferences['dataUsage']>>
  ): Promise<void> {
    this.preferences.dataUsage = {
      ...this.getDataUsagePreferences()!,
      ...dataUsage,
    };
    await this.savePreferences();
  }

  /**
   * Update multiple preferences at once
   */
  async updatePreferences(updates: Partial<UserPreferences>): Promise<void> {
    this.preferences = {
      ...this.preferences,
      ...updates,
    };
    await this.savePreferences();
  }

  /**
   * Get formatted currency and region info for display
   */
  async getFormattedCurrencyRegion(): Promise<string> {
    const country = this.preferences.country;
    const currency = this.preferences.currency;

    if (country && currency) {
      const region = country.region || 'Southern Africa';
      return `${currency} - ${country.name} (${region})`;
    } else if (currency) {
      return currency;
    } else {
      return 'BWP - Botswana (Southern Africa)';
    }
  }

  /**
   * Clear all preferences
   */
  async clearPreferences(): Promise<void> {
    this.preferences = {};
    try {
      await AsyncStorage.removeItem(PREFERENCES_KEY);
      this.notifyListeners();
    } catch (error) {
      log.error('Failed to clear preferences', error);
    }
  }

  /**
   * Subscribe to preference changes
   */
  subscribe(listener: (preferences: UserPreferences) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of preference changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      listener(this.preferences);
    });
  }
}

export default UserPreferencesService;
