/**
 * @fileoverview Package tracking screen with real-time location updates
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import PackageService from '../../services/PackageService';
import LoadingScreen from '../../components/common/LoadingScreen';
import { CourierStackParamList } from '../../navigation/CourierNavigator';

// Mock Map Component
const MockMapView: React.FC<{
  pickup: [number, number];
  dropoff: [number, number];
  courierLocations?: Array<{ location: [number, number]; timestamp: string }>;
}> = ({ pickup, dropoff, courierLocations }) => {
  return (
    <View style={styles.mapContainer}>
      <View style={styles.mapPlaceholder}>
        <Icon name="map" size={60} color={colors.text.secondary} />
        <Text style={styles.mapText}>Live Tracking Map</Text>
        <Text style={styles.mapSubtext}>
          Real-time location updates during delivery
        </Text>
        
        {/* Mock route visualization */}
        <View style={styles.routeInfo}>
          <View style={styles.locationPin}>
            <Icon name="place" size={20} color={colors.primary} />
            <Text style={styles.pinLabel}>Pickup</Text>
          </View>
          
          <View style={styles.routeLine}>
            {courierLocations && courierLocations.length > 0 && (
              <View style={styles.courierDot}>
                <Icon name="local-shipping" size={16} color={colors.warning} />
              </View>
            )}
          </View>
          
          <View style={styles.locationPin}>
            <Icon name="flag" size={20} color={colors.success} />
            <Text style={styles.pinLabel}>Delivery</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

type PackageTrackingRouteProp = RouteProp<CourierStackParamList, 'PackageTracking'>;

const PackageTrackingScreen: React.FC = () => {
  const route = useRoute<PackageTrackingRouteProp>();
  const navigation = useNavigation();
  const { packageId } = route.params;
  
  interface PackageData {
    id: string;
    title: string;
    pickupAddress: string;
    dropoffAddress: string;
    packageSize: string;
    fragile: boolean;
    valuable: boolean;
    senderPriceOffer: number;
    createdAt: string;
  }
  interface CourierData {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  }
  interface DeliveryAgreementData {
    id: string;
    status: string;
    courierId: string;
    agreedPrice: number;
    platformFee: number;
    courier?: CourierData;
  }
  interface CourierLocationData {
    location: [number, number];
    timestamp: string;
    accuracy?: number;
    speed?: number;
  }
  interface TrackingData {
    package: PackageData;
    deliveryAgreement?: DeliveryAgreementData;
    courierLocations?: CourierLocationData[];
  }
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTrackingData();
    
    // Set up real-time updates (mock)
    const interval = setInterval(loadTrackingData, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [packageId]);

  const loadTrackingData = async () => {
    try {
      const response = await PackageService.getPackageTracking(packageId);
      if (response.success && response.data) {
        setTrackingData(response.data);
      } else {
        // Mock data for demonstration
        setTrackingData({
          package: {
            id: packageId,
            title: 'Sample Package',
            pickupAddress: '123 Main St, New York, NY',
            dropoffAddress: '456 Oak Ave, New York, NY',
            packageSize: 'medium',
            fragile: true,
            valuable: false,
            senderPriceOffer: 25.00,
            createdAt: new Date().toISOString(),
          },
          deliveryAgreement: {
            id: 'agreement_123',
            status: 'in_transit',
            courierId: 'courier_456',
            agreedPrice: 25.00,
            platformFee: 2.50,
            courier: {
              id: 'courier_456',
              firstName: 'John',
              lastName: 'Doe',
              phone: '+1234567890',
            },
          },
          courierLocations: [
            {
              location: [-74.0060, 40.7128],
              timestamp: new Date(Date.now() - 300000).toISOString(),
              accuracy: 5,
              speed: 25,
            },
            {
              location: [-74.0050, 40.7140],
              timestamp: new Date(Date.now() - 180000).toISOString(),
              accuracy: 3,
              speed: 30,
            },
            {
              location: [-74.0040, 40.7150],
              timestamp: new Date().toISOString(),
              accuracy: 4,
              speed: 20,
            },
          ],
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load tracking information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTrackingData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_pickup':
        return colors.warning;
      case 'in_transit':
        return colors.primary;
      case 'completed':
        return colors.success;
      case 'disputed':
        return colors.error;
      default:
        return colors.text.secondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_pickup':
        return 'Waiting for Pickup';
      case 'in_transit':
        return 'In Transit';
      case 'completed':
        return 'Delivered';
      case 'disputed':
        return 'Disputed';
      default:
        return 'Unknown';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (loading) {
    return <LoadingScreen message="Loading package tracking..." />;
  }

  if (!trackingData) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={80} color={colors.error} />
        <Text style={styles.errorText}>Tracking information not available</Text>
      </View>
    );
  }

  const { package: pkg, deliveryAgreement, courierLocations } = trackingData;

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MockMapView
        pickup={[-74.0060, 40.7128]}
        dropoff={[-73.9851, 40.7589]}
        courierLocations={courierLocations as Array<{ location: [number, number]; timestamp: string }>}
      />

      <ScrollView style={styles.content}>
        {/* Status Header */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(deliveryAgreement?.status as string) }
            ]}>
              <Text style={styles.statusText}>
                {getStatusText(deliveryAgreement?.status as string)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
            >
              <Icon 
                name="refresh" 
                size={20} 
                color={refreshing ? colors.warning : colors.text.secondary} 
              />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.packageTitle}>{pkg.title}</Text>
          
          {deliveryAgreement?.courier && (
            <View style={styles.courierInfo}>
              <Icon name="person" size={20} color={colors.text.secondary} />
              <Text style={styles.courierName}>
                {deliveryAgreement.courier.firstName} {deliveryAgreement.courier.lastName}
              </Text>
            </View>
          )}
        </View>

        {/* Live Updates */}
        {courierLocations && courierLocations.length > 0 && (
          <View style={styles.liveCard}>
            <View style={styles.liveHeader}>
              <Icon name="my-location" size={20} color={colors.success} />
              <Text style={styles.liveTitle}>Live Tracking</Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            
            <View style={styles.speedInfo}>
              <View style={styles.speedItem}>
                <Text style={styles.speedLabel}>Speed</Text>
                <Text style={styles.speedValue}>
                  {(courierLocations[courierLocations.length - 1]?.speed as number) || 0} km/h
                </Text>
              </View>
              <View style={styles.speedItem}>
                <Text style={styles.speedLabel}>Last Update</Text>
                <Text style={styles.speedValue}>
                  {formatTime(courierLocations[courierLocations.length - 1]?.timestamp as string)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Package Information */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Package Details</Text>
          
          <View style={styles.infoRow}>
            <Icon name="category" size={20} color={colors.text.secondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Size</Text>
              <Text style={styles.infoValue}>{pkg.packageSize}</Text>
            </View>
          </View>

          <View style={styles.tagsRow}>
            {pkg.fragile && (
              <View style={styles.fragileTag}>
                <Icon name="warning" size={16} color={colors.warning} />
                <Text style={styles.fragileText}>Fragile</Text>
              </View>
            )}
            {pkg.valuable && (
              <View style={styles.valuableTag}>
                <Icon name="diamond" size={16} color={colors.primary} />
                <Text style={styles.valuableText}>Valuable</Text>
              </View>
            )}
          </View>
        </View>

        {/* Address Information */}
        <View style={styles.addressCard}>
          <Text style={styles.cardTitle}>Delivery Route</Text>
          
          <View style={styles.addressItem}>
            <View style={styles.addressIcon}>
              <Icon name="place" size={20} color={colors.primary} />
            </View>
            <View style={styles.addressContent}>
              <Text style={styles.addressLabel}>Pickup</Text>
              <Text style={styles.addressText}>{pkg.pickupAddress}</Text>
            </View>
          </View>
          
          <View style={styles.routeConnector}>
            <View style={styles.routeDots}>
              <View style={styles.routeDot} />
              <View style={styles.routeDot} />
              <View style={styles.routeDot} />
            </View>
          </View>
          
          <View style={styles.addressItem}>
            <View style={styles.addressIcon}>
              <Icon name="flag" size={20} color={colors.success} />
            </View>
            <View style={styles.addressContent}>
              <Text style={styles.addressLabel}>Delivery</Text>
              <Text style={styles.addressText}>{pkg.dropoffAddress}</Text>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.cardTitle}>Delivery Timeline</Text>
          
          <View style={styles.timelineItem}>
            <View style={[styles.timelineIcon, { backgroundColor: colors.success }]}>
              <Icon name="check" size={16} color={colors.text.inverse} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Package Created</Text>
              <Text style={styles.timelineTime}>
                {formatDate(pkg.createdAt)} at {formatTime(pkg.createdAt)}
              </Text>
            </View>
          </View>

          {deliveryAgreement && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineIcon, { backgroundColor: colors.success }]}>
                <Icon name="check" size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Courier Assigned</Text>
                <Text style={styles.timelineTime}>
                  {deliveryAgreement.courier?.firstName} {deliveryAgreement.courier?.lastName}
                </Text>
              </View>
            </View>
          )}

          {deliveryAgreement?.status !== 'pending_pickup' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineIcon, { backgroundColor: colors.success }]}>
                <Icon name="check" size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Package Picked Up</Text>
                <Text style={styles.timelineTime}>Confirmed</Text>
              </View>
            </View>
          )}

          {deliveryAgreement?.status === 'in_transit' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineIcon, { backgroundColor: colors.primary }]}>
                <Icon name="local-shipping" size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>In Transit</Text>
                <Text style={styles.timelineTime}>Live tracking active</Text>
              </View>
            </View>
          )}

          {deliveryAgreement?.status === 'completed' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineIcon, { backgroundColor: colors.success }]}>
                <Icon name="check" size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Package Delivered</Text>
                <Text style={styles.timelineTime}>Completed successfully</Text>
              </View>
            </View>
          )}
        </View>

        {/* Contact Information */}
        {deliveryAgreement?.courier && (
          <View style={styles.contactCard}>
            <Text style={styles.cardTitle}>Contact Courier</Text>
            
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => {
                if (deliveryAgreement.courier?.phone) {
                  Linking.openURL(`tel:${deliveryAgreement.courier.phone}`);
                }
              }}
            >
              <Icon name="phone" size={20} color={colors.primary} />
              <Text style={styles.contactButtonText}>
                Call {deliveryAgreement.courier.firstName}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  mapContainer: {
    height: 250,
    backgroundColor: colors.background.secondary,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  mapText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 8,
  },
  mapSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  locationPin: {
    alignItems: 'center',
  },
  pinLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  routeLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border.light,
    marginHorizontal: 16,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierDot: {
    backgroundColor: colors.warning,
    borderRadius: 12,
    padding: 4,
    position: 'absolute',
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  errorText: {
    fontSize: 18,
    color: colors.error,
    marginTop: 16,
  },
  statusCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    color: colors.text.inverse,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
  },
  packageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  courierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courierName: {
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: 8,
  },
  liveCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 4,
  },
  liveText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: 'bold',
  },
  speedInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  speedItem: {
    alignItems: 'center',
  },
  speedLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  speedValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: colors.text.primary,
  },
  tagsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  fragileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  fragileText: {
    fontSize: 12,
    color: colors.warning,
    marginLeft: 4,
  },
  valuableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  valuableText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 4,
  },
  addressCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIcon: {
    width: 40,
    alignItems: 'center',
    paddingTop: 2,
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 16,
    color: colors.text.primary,
    lineHeight: 22,
  },
  routeConnector: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  routeDots: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  routeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.light,
    marginVertical: 2,
  },
  timelineCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  timelineTime: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  contactCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '20',
    paddingVertical: 12,
    borderRadius: 8,
  },
  contactButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default PackageTrackingScreen;