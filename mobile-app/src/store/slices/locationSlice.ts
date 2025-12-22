/**
 * @fileoverview Location and geolocation state slice
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import Geolocation from '@react-native-community/geolocation';
import { PERMISSIONS, RESULTS, request, check } from 'react-native-permissions';
import { Platform, Alert, Linking } from 'react-native';

// Types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationData extends Coordinates {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  timestamp: number;
  accuracy?: number;
}

export interface LocationState {
  currentLocation: LocationData | null;
  destination: LocationData | null;
  hasLocationPermission: boolean;
  isLoadingLocation: boolean;
  isWatchingLocation: boolean;
  watchId: number | null;
  locationError: string | null;
  lastLocationUpdate: number | null;
  searchHistory: LocationData[];
  favorites: LocationData[];
}

// Initial state
const initialState: LocationState = {
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
};

// Location permission helper
const getLocationPermission = async (): Promise<boolean> => {
  const permission = Platform.OS === 'ios' 
    ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE 
    : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

  const result = await check(permission);
  
  switch (result) {
    case RESULTS.GRANTED:
      return true;
    case RESULTS.DENIED:
      const requestResult = await request(permission);
      return requestResult === RESULTS.GRANTED;
    case RESULTS.BLOCKED:
      Alert.alert(
        'Location Permission Required',
        'Please enable location permission in your device settings to use this feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    default:
      return false;
  }
};

// Reverse geocoding helper (simplified - in real app use Google Places API)
const reverseGeocode = async (latitude: number, longitude: number): Promise<Partial<LocationData>> => {
  try {
    // This is a placeholder - implement actual reverse geocoding
    return {
      address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      city: 'Unknown City',
      country: 'Unknown Country',
    };
  } catch (error) {
    return {
      address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    };
  }
};

// Async thunks
export const requestLocationPermission = createAsyncThunk(
  'location/requestLocationPermission',
  async (_, { rejectWithValue }) => {
    try {
      const hasPermission = await getLocationPermission();
      return hasPermission;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to request location permission');
    }
  }
);

export const getCurrentLocation = createAsyncThunk(
  'location/getCurrentLocation',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { location: LocationState };
      
      if (!state.location.hasLocationPermission) {
        const hasPermission = await getLocationPermission();
        if (!hasPermission) {
          return rejectWithValue('Location permission denied');
        }
      }

      return new Promise<LocationData>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            const timestamp = position.timestamp;
            
            try {
              const geocodeData = await reverseGeocode(latitude, longitude);
              
              const locationData: LocationData = {
                latitude,
                longitude,
                accuracy,
                timestamp,
                ...geocodeData,
              };
              
              resolve(locationData);
            } catch (geocodeError) {
              // Still resolve with coordinates even if geocoding fails
              resolve({
                latitude,
                longitude,
                accuracy,
                timestamp,
                address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              });
            }
          },
          (error) => {
            reject(error.message || 'Failed to get current location');
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 10000,
          }
        );
      });
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to get current location');
    }
  }
);

export const startLocationWatch = createAsyncThunk(
  'location/startLocationWatch',
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState() as { location: LocationState };
      
      if (!state.location.hasLocationPermission) {
        const hasPermission = await getLocationPermission();
        if (!hasPermission) {
          return rejectWithValue('Location permission denied');
        }
      }

      if (state.location.isWatchingLocation) {
        return state.location.watchId;
      }

      const watchId = Geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const timestamp = position.timestamp;
          
          try {
            const geocodeData = await reverseGeocode(latitude, longitude);
            
            const locationData: LocationData = {
              latitude,
              longitude,
              accuracy,
              timestamp,
              ...geocodeData,
            };
            
            dispatch(updateCurrentLocation(locationData));
          } catch (geocodeError) {
            dispatch(updateCurrentLocation({
              latitude,
              longitude,
              accuracy,
              timestamp,
              address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            }));
          }
        },
        (error) => {
          dispatch(setLocationError(error.message || 'Location watch failed'));
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10, // Update only if moved 10 meters
          interval: 5000, // Update every 5 seconds
        }
      );

      return watchId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to start location watch');
    }
  }
);

export const stopLocationWatch = createAsyncThunk(
  'location/stopLocationWatch',
  async (_, { getState }) => {
    const state = getState() as { location: LocationState };
    
    if (state.location.watchId !== null) {
      Geolocation.clearWatch(state.location.watchId);
      return true;
    }
    
    return false;
  }
);

// Location slice
const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setCurrentLocation: (state, action: PayloadAction<LocationData>) => {
      state.currentLocation = action.payload;
      state.lastLocationUpdate = Date.now();
      state.locationError = null;
    },
    updateCurrentLocation: (state, action: PayloadAction<LocationData>) => {
      state.currentLocation = action.payload;
      state.lastLocationUpdate = Date.now();
    },
    setDestination: (state, action: PayloadAction<LocationData | null>) => {
      state.destination = action.payload;
    },
    setLocationPermission: (state, action: PayloadAction<boolean>) => {
      state.hasLocationPermission = action.payload;
    },
    setLocationLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingLocation = action.payload;
    },
    setLocationError: (state, action: PayloadAction<string | null>) => {
      state.locationError = action.payload;
    },
    clearLocationError: (state) => {
      state.locationError = null;
    },
    addToSearchHistory: (state, action: PayloadAction<LocationData>) => {
      const existingIndex = state.searchHistory.findIndex(
        location => location.latitude === action.payload.latitude && 
                   location.longitude === action.payload.longitude
      );
      
      if (existingIndex !== -1) {
        state.searchHistory.splice(existingIndex, 1);
      }
      
      state.searchHistory.unshift(action.payload);
      
      // Keep only last 10 searches
      if (state.searchHistory.length > 10) {
        state.searchHistory = state.searchHistory.slice(0, 10);
      }
    },
    addToFavorites: (state, action: PayloadAction<LocationData>) => {
      const exists = state.favorites.some(
        location => location.latitude === action.payload.latitude && 
                   location.longitude === action.payload.longitude
      );
      
      if (!exists) {
        state.favorites.push(action.payload);
      }
    },
    removeFromFavorites: (state, action: PayloadAction<Coordinates>) => {
      state.favorites = state.favorites.filter(
        location => !(location.latitude === action.payload.latitude && 
                     location.longitude === action.payload.longitude)
      );
    },
    clearLocation: (state) => {
      state.currentLocation = null;
      state.destination = null;
      state.locationError = null;
      state.lastLocationUpdate = null;
    },
    clearSearchHistory: (state) => {
      state.searchHistory = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Request location permission cases
      .addCase(requestLocationPermission.fulfilled, (state, action) => {
        state.hasLocationPermission = action.payload;
        if (!action.payload) {
          state.locationError = 'Location permission denied';
        }
      })
      .addCase(requestLocationPermission.rejected, (state, action) => {
        state.hasLocationPermission = false;
        state.locationError = action.payload as string;
      })
      
      // Get current location cases
      .addCase(getCurrentLocation.pending, (state) => {
        state.isLoadingLocation = true;
        state.locationError = null;
      })
      .addCase(getCurrentLocation.fulfilled, (state, action) => {
        state.isLoadingLocation = false;
        state.currentLocation = action.payload;
        state.lastLocationUpdate = Date.now();
        state.locationError = null;
        state.hasLocationPermission = true;
      })
      .addCase(getCurrentLocation.rejected, (state, action) => {
        state.isLoadingLocation = false;
        state.locationError = action.payload as string;
      })
      
      // Start location watch cases
      .addCase(startLocationWatch.fulfilled, (state, action) => {
        state.isWatchingLocation = true;
        state.watchId = action.payload;
        state.hasLocationPermission = true;
      })
      .addCase(startLocationWatch.rejected, (state, action) => {
        state.isWatchingLocation = false;
        state.locationError = action.payload as string;
      })
      
      // Stop location watch cases
      .addCase(stopLocationWatch.fulfilled, (state) => {
        state.isWatchingLocation = false;
        state.watchId = null;
      });
  },
});

export const {
  setCurrentLocation,
  updateCurrentLocation,
  setDestination,
  setLocationPermission,
  setLocationLoading,
  setLocationError,
  clearLocationError,
  addToSearchHistory,
  addToFavorites,
  removeFromFavorites,
  clearLocation,
  clearSearchHistory,
} = locationSlice.actions;

export default locationSlice;