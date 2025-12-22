/**
 * @fileoverview Settings slice for admin panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { settingsService } from '../../services/api';

export interface CommissionSettings {
  rideCommission: number;
  courierCommission: number;
  cancellationFee: number;
  minimumFare: number;
}

export interface ContentSettings {
  aboutUs: string;
  termsOfService: string;
  privacyPolicy: string;
  helpFaq: Array<{
    question: string;
    answer: string;
    category: string;
  }>;
}

export interface AppSettings {
  appName: string;
  supportEmail: string;
  supportPhone: string;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  defaultLanguage: string;
  supportedLanguages: string[];
  notificationSettings: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    smsNotifications: boolean;
  };
  mapSettings: {
    defaultZoom: number;
    maxRadius: number;
    allowCustomRoutes: boolean;
  };
  paymentSettings: {
    allowCashPayments: boolean;
    allowWalletPayments: boolean;
    autoRefundEnabled: boolean;
    refundProcessingDays: number;
  };
}

interface SettingsState {
  appSettings: AppSettings | null;
  commissionSettings: CommissionSettings | null;
  contentSettings: ContentSettings | null;
  loading: {
    app: boolean;
    commission: boolean;
    content: boolean;
  };
  error: string | null;
  isDirty: {
    app: boolean;
    commission: boolean;
    content: boolean;
  };
}

const initialState: SettingsState = {
  appSettings: null,
  commissionSettings: null,
  contentSettings: null,
  loading: {
    app: false,
    commission: false,
    content: false,
  },
  error: null,
  isDirty: {
    app: false,
    commission: false,
    content: false,
  },
};

// Async thunks
export const fetchAppSettings = createAsyncThunk('settings/fetchAppSettings', async (_, { rejectWithValue }) => {
  try {
    const response = await settingsService.getSettings();
    return response.data.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch app settings');
  }
});

export const updateAppSettings = createAsyncThunk(
  'settings/updateAppSettings',
  async (settings: Partial<AppSettings>, { rejectWithValue }) => {
    try {
      const response = await settingsService.updateSettings(settings);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update app settings');
    }
  }
);

export const fetchCommissionSettings = createAsyncThunk(
  'settings/fetchCommissionSettings',
  async (_, { rejectWithValue }) => {
    try {
      const response = await settingsService.getCommissionSettings();
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch commission settings');
    }
  }
);

export const updateCommissionSettings = createAsyncThunk(
  'settings/updateCommissionSettings',
  async (settings: Partial<CommissionSettings>, { rejectWithValue }) => {
    try {
      const response = await settingsService.updateCommissionSettings(settings);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update commission settings');
    }
  }
);

export const fetchContentSettings = createAsyncThunk(
  'settings/fetchContentSettings',
  async (_, { rejectWithValue }) => {
    try {
      const response = await settingsService.getContentSettings();
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch content settings');
    }
  }
);

export const updateContentSettings = createAsyncThunk(
  'settings/updateContentSettings',
  async (content: Partial<ContentSettings>, { rejectWithValue }) => {
    try {
      const response = await settingsService.updateContentSettings(content);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update content settings');
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },
    setAppSettingsDirty: (state, action: PayloadAction<boolean>) => {
      state.isDirty.app = action.payload;
    },
    setCommissionSettingsDirty: (state, action: PayloadAction<boolean>) => {
      state.isDirty.commission = action.payload;
    },
    setContentSettingsDirty: (state, action: PayloadAction<boolean>) => {
      state.isDirty.content = action.payload;
    },
    updateLocalAppSettings: (state, action: PayloadAction<Partial<AppSettings>>) => {
      if (state.appSettings) {
        state.appSettings = { ...state.appSettings, ...action.payload };
        state.isDirty.app = true;
      }
    },
    updateLocalCommissionSettings: (state, action: PayloadAction<Partial<CommissionSettings>>) => {
      if (state.commissionSettings) {
        state.commissionSettings = {
          ...state.commissionSettings,
          ...action.payload,
        };
        state.isDirty.commission = true;
      }
    },
    updateLocalContentSettings: (state, action: PayloadAction<Partial<ContentSettings>>) => {
      if (state.contentSettings) {
        state.contentSettings = { ...state.contentSettings, ...action.payload };
        state.isDirty.content = true;
      }
    },
    resetToOriginal: (state, action: PayloadAction<'app' | 'commission' | 'content'>) => {
      const type = action.payload;
      state.isDirty[type] = false;
      // Note: In a real implementation, you'd store original values to reset to
    },
  },
  extraReducers: builder => {
    builder
      // Fetch app settings
      .addCase(fetchAppSettings.pending, state => {
        state.loading.app = true;
        state.error = null;
      })
      .addCase(fetchAppSettings.fulfilled, (state, action) => {
        state.loading.app = false;
        state.appSettings = action.payload;
        state.isDirty.app = false;
      })
      .addCase(fetchAppSettings.rejected, (state, action) => {
        state.loading.app = false;
        state.error = action.payload as string;
      })

      // Update app settings
      .addCase(updateAppSettings.pending, state => {
        state.loading.app = true;
        state.error = null;
      })
      .addCase(updateAppSettings.fulfilled, (state, action) => {
        state.loading.app = false;
        state.appSettings = action.payload;
        state.isDirty.app = false;
      })
      .addCase(updateAppSettings.rejected, (state, action) => {
        state.loading.app = false;
        state.error = action.payload as string;
      })

      // Fetch commission settings
      .addCase(fetchCommissionSettings.pending, state => {
        state.loading.commission = true;
        state.error = null;
      })
      .addCase(fetchCommissionSettings.fulfilled, (state, action) => {
        state.loading.commission = false;
        state.commissionSettings = action.payload;
        state.isDirty.commission = false;
      })
      .addCase(fetchCommissionSettings.rejected, (state, action) => {
        state.loading.commission = false;
        state.error = action.payload as string;
      })

      // Update commission settings
      .addCase(updateCommissionSettings.pending, state => {
        state.loading.commission = true;
        state.error = null;
      })
      .addCase(updateCommissionSettings.fulfilled, (state, action) => {
        state.loading.commission = false;
        state.commissionSettings = action.payload;
        state.isDirty.commission = false;
      })
      .addCase(updateCommissionSettings.rejected, (state, action) => {
        state.loading.commission = false;
        state.error = action.payload as string;
      })

      // Fetch content settings
      .addCase(fetchContentSettings.pending, state => {
        state.loading.content = true;
        state.error = null;
      })
      .addCase(fetchContentSettings.fulfilled, (state, action) => {
        state.loading.content = false;
        state.contentSettings = action.payload;
        state.isDirty.content = false;
      })
      .addCase(fetchContentSettings.rejected, (state, action) => {
        state.loading.content = false;
        state.error = action.payload as string;
      })

      // Update content settings
      .addCase(updateContentSettings.pending, state => {
        state.loading.content = true;
        state.error = null;
      })
      .addCase(updateContentSettings.fulfilled, (state, action) => {
        state.loading.content = false;
        state.contentSettings = action.payload;
        state.isDirty.content = false;
      })
      .addCase(updateContentSettings.rejected, (state, action) => {
        state.loading.content = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  clearError,
  setAppSettingsDirty,
  setCommissionSettingsDirty,
  setContentSettingsDirty,
  updateLocalAppSettings,
  updateLocalCommissionSettings,
  updateLocalContentSettings,
  resetToOriginal,
} = settingsSlice.actions;

export default settingsSlice.reducer;

// Selectors
export const selectAppSettings = (state: { settings: SettingsState }) => state.settings.appSettings;
export const selectCommissionSettings = (state: { settings: SettingsState }) => state.settings.commissionSettings;
export const selectContentSettings = (state: { settings: SettingsState }) => state.settings.contentSettings;
export const selectSettingsLoading = (state: { settings: SettingsState }) => state.settings.loading;
export const selectSettingsError = (state: { settings: SettingsState }) => state.settings.error;
export const selectSettingsDirty = (state: { settings: SettingsState }) => state.settings.isDirty;
