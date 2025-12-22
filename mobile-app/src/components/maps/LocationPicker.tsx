/**
 * @fileoverview Location picker component for selecting pickup/destination points
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Input, Button } from '../ui';
import HitchMapView from './MapView';
import locationService, { LocationCoordinates, LocationData } from '../../services/LocationService';

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationData) => void;
  initialLocation?: LocationData;
  title?: string;
  placeholder?: string;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  visible,
  onClose,
  onLocationSelect,
  initialLocation,
  title = 'Select Location',
  placeholder = 'Search for a location or tap on the map',
}) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(initialLocation || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingCurrentLocation, setIsLoadingCurrentLocation] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCurrentLocation();
    }
  }, [visible]);

  const loadCurrentLocation = async () => {
    setIsLoadingCurrentLocation(true);
    try {
      const location = await locationService.getCurrentLocation();
      setCurrentLocation(location);
      
      // If no initial location provided, center map on current location
      if (!initialLocation) {
        setSelectedLocation(location);
      }
    } catch (error: any) {
      console.error('Failed to get current location:', error);
      Alert.alert('Location Error', error.message || 'Unable to get current location');
    } finally {
      setIsLoadingCurrentLocation(false);
    }
  };

  const handleMapPress = async (coordinate: LocationCoordinates) => {
    try {
      const address = await locationService.reverseGeocode(
        coordinate.latitude,
        coordinate.longitude
      );
      
      const locationData: LocationData = {
        ...coordinate,
        address: {
          ...address,
          fullAddress: address.fullAddress,
        },
      };
      
      setSelectedLocation(locationData);
    } catch (error) {
      console.error('Failed to get address for location:', error);
      // Still allow selection without address
      setSelectedLocation({
        ...coordinate,
        address: {
          fullAddress: `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`,
        },
      });
    }
  };

  const handleUseCurrentLocation = () => {
    if (currentLocation) {
      setSelectedLocation(currentLocation);
    }
  };

  const handleSearchSubmit = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await locationService.geocodeAddress(searchQuery.trim());
      if (results.length > 0) {
        const coordinate = results[0];
        await handleMapPress(coordinate);
      } else {
        Alert.alert('No Results', 'No locations found for your search');
      }
    } catch (error: any) {
      Alert.alert('Search Error', error.message || 'Failed to search location');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation);
      onClose();
    } else {
      Alert.alert('No Location Selected', 'Please select a location on the map or search for one');
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedLocation(initialLocation || null);
    onClose();
  };

  const getMapRegion = () => {
    if (selectedLocation) {
      return {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    
    if (currentLocation) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    return {
      latitude: 37.7749,
      longitude: -122.4194,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  };

  const getRideMapData = () => {
    if (!selectedLocation) return [];

    return [{
      id: 'selected-location',
      origin: {
        ...selectedLocation,
        address: selectedLocation.address?.formatted,
      },
      destination: {
        ...selectedLocation,
        address: selectedLocation.address?.formatted,
      },
    }];
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Icon name="close" size={24} color="#666666" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Input
            placeholder={placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon="search"
            rightIcon={searchQuery ? "clear" : undefined}
            onRightIconPress={() => setSearchQuery('')}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            containerStyle={styles.searchInput}
          />
          
          <TouchableOpacity
            style={[styles.currentLocationButton, isLoadingCurrentLocation && styles.disabled]}
            onPress={handleUseCurrentLocation}
            disabled={isLoadingCurrentLocation || !currentLocation}
            activeOpacity={0.8}
          >
            <Icon
              name="my-location"
              size={20}
              color={currentLocation ? '#2196F3' : '#CCCCCC'}
            />
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <HitchMapView
            initialRegion={getMapRegion()}
            currentLocation={currentLocation || undefined}
            rides={getRideMapData()}
            selectedRideId="selected-location"
            onMapPress={handleMapPress}
            showTraffic={false}
          />
          
          {/* Crosshair overlay */}
          <View style={styles.crosshair} pointerEvents="none">
            <Icon name="add" size={32} color="#2196F3" />
          </View>
        </View>

        {/* Selected Location Info */}
        {selectedLocation && (
          <View style={styles.locationInfo}>
            <View style={styles.locationDetails}>
              <Icon name="location-on" size={20} color="#2196F3" />
              <View style={styles.locationText}>
                <Text style={styles.locationAddress}>
                  {selectedLocation.address?.fullAddress || 'Selected Location'}
                </Text>
                <Text style={styles.locationCoordinates}>
                  {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {searchQuery.trim() && (
            <Button
              title={isSearching ? 'Searching...' : 'Search'}
              onPress={handleSearchSubmit}
              disabled={isSearching}
              loading={isSearching}
              variant="outline"
              size="medium"
              icon="search"
              style={styles.searchButton}
            />
          )}
          
          <Button
            title="Confirm Location"
            onPress={handleConfirmSelection}
            disabled={!selectedLocation}
            variant="primary"
            size="medium"
            icon="check"
            style={styles.confirmButton}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  currentLocationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  disabled: {
    opacity: 0.5,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  crosshair: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16,
    marginLeft: -16,
    zIndex: 10,
  },
  locationInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  locationDetails: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationText: {
    flex: 1,
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  locationCoordinates: {
    fontSize: 12,
    color: '#666666',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  searchButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 2,
  },
});

export default LocationPicker;