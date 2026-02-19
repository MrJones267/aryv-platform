/**
 * @fileoverview QR code scanner for package delivery verification (Updated for Vision Camera)
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2026-01-09
 */

import React, { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Camera, useCameraDevices, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';

import { colors } from '../../theme';
import PackageService from '../../services/PackageService';
import { CourierStackParamList } from '../../navigation/CourierNavigator';
import LocationService from '../../services/LocationService';
import logger from '../../services/LoggingService';

const log = logger.createLogger('QRScannerScreen');

// Updated camera component with Vision Camera
const CameraView: React.FC<{
  onBarCodeRead: (data: { data: string }) => void;
  scanning: boolean;
  agreementId?: string;
}> = ({ onBarCodeRead, scanning, agreementId }) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const devices = useCameraDevices();
  const device = devices.find((d: { position: string }) => d.position === 'back') || devices[0];
  const [mockScanned, setMockScanned] = useState(false);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: (codes) => {
      if (scanning && codes.length > 0) {
        onBarCodeRead({ data: codes[0].value || '' });
      }
    },
  });

  const simulateScan = () => {
    if (!mockScanned && scanning) {
      setMockScanned(true);
      // Generate cryptographically secure QR token for demo
      setTimeout(() => {
        const timestamp = new Date().toISOString();
        const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const tokenData = {
          deliveryId: agreementId || 'demo_delivery',
          timestamp,
          nonce: randomId,
        };
        const secureToken = CryptoJS.SHA256(JSON.stringify(tokenData) + 'QR_SECRET_KEY').toString();
        const qrToken = `ARYV_QR_${secureToken.substring(0, 16)}_${Date.now()}`;
        
        onBarCodeRead({ data: qrToken });
        setMockScanned(false);
      }, 1000);
    }
  };

  // Use real camera if permission granted and device available
  if (hasPermission && device) {
    return (
      <Camera
        style={styles.camera}
        device={device}
        isActive={scanning}
        codeScanner={codeScanner}
      >
        {/* Scan area overlay */}
        <View style={styles.scanArea}>
          <View style={styles.scanCorners}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>
      </Camera>
    );
  }

  // Fallback to mock camera for development/testing
  return (
    <View style={styles.mockCamera}>
      <View style={styles.scanArea}>
        <View style={styles.scanCorners}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>
      
      <View style={styles.scanInstructions}>
        <Text style={styles.scanText}>
          {!hasPermission 
            ? 'Camera permission required for scanning' 
            : 'Position QR code within the frame'}
        </Text>
        {!hasPermission ? (
          <TouchableOpacity style={styles.mockScanButton} onPress={requestPermission}>
            <Text style={styles.mockScanText}>Grant Camera Permission</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.mockScanButton} onPress={simulateScan}>
            <Text style={styles.mockScanText}>
              {mockScanned ? 'Scanning...' : 'Simulate Scan (Demo)'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// QR Scanner Screen Component
type QRScannerScreenRouteProp = RouteProp<CourierStackParamList, 'QRScanner'>;

const QRScannerScreen: React.FC = () => {
  const route = useRoute<QRScannerScreenRouteProp>();
  const navigation = useNavigation();
  const { agreementId } = route.params || {};
  
  const [scanning, setScanning] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);

  const handleBarCodeRead = async (data: { data: string }) => {
    if (!scanning) return;

    setScanning(false);
    setScannedData(data.data);

    try {
      // Validate QR code format
      if (!data.data || !data.data.includes('ARYV_QR_')) {
        Alert.alert('Invalid QR Code', 'This QR code is not valid for ARYV deliveries.');
        setScanning(true);
        return;
      }

      // Get current location for verification
      const currentLocation = await LocationService.getCurrentLocation();

      // Verify delivery with backend
      const result = await PackageService.verifyDeliveryQR(
        data.data,
        [currentLocation.latitude, currentLocation.longitude],
      );

      if (result.success) {
        const resultData = result.data as Record<string, unknown> | undefined;
        Alert.alert(
          'QR Code Verified',
          `Package verified successfully for ${(resultData?.deliveryType as string) || 'delivery'}`,
          [
            {
              text: 'Continue',
              onPress: () => {
                // Navigate to appropriate screen based on delivery type
                navigation.goBack();
              },
            },
          ],
        );
      } else {
        Alert.alert('Verification Failed', result.error || 'Unable to verify QR code');
        setScanning(true);
      }
    } catch (error) {
      log.error('QR verification error:', error);
      Alert.alert('Error', 'Failed to verify QR code. Please try again.');
      setScanning(true);
    }
  };

  const toggleFlash = () => {
    setFlashOn(!flashOn);
  };

  const resetScanner = () => {
    setScanning(true);
    setScannedData(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
          <Icon name={flashOn ? "flash-on" : "flash-off"} size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <CameraView 
        onBarCodeRead={handleBarCodeRead} 
        scanning={scanning} 
        agreementId={agreementId}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.resetButton} onPress={resetScanner}>
          <Icon name="refresh" size={24} color={colors.white} />
          <Text style={styles.resetText}>Reset Scanner</Text>
        </TouchableOpacity>
        
        {scannedData && (
          <View style={styles.scannedInfo}>
            <Text style={styles.scannedLabel}>Scanned Data:</Text>
            <Text style={styles.scannedValue} numberOfLines={2}>
              {scannedData.substring(0, 50)}...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Styles
const { width, height } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    backgroundColor: colors.white,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  flashButton: {
    padding: 8,
  },
  camera: {
    flex: 1,
    width: width,
    height: height * 0.7,
  },
  mockCamera: {
    flex: 1,
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    position: 'absolute',
    top: height * 0.2,
    left: width * 0.1,
    right: width * 0.1,
    bottom: height * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanCorners: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanInstructions: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  scanText: {
    color: colors.white,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  mockScanButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  mockScanText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: colors.white,
    padding: 20,
    alignItems: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  resetText: {
    color: colors.white,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  scannedInfo: {
    alignItems: 'center',
    marginTop: 10,
  },
  scannedLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  scannedValue: {
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});

export default QRScannerScreen;