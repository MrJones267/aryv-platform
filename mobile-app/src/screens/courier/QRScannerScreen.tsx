/**
 * @fileoverview QR code scanner for package delivery verification
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
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
import { RNCamera } from 'react-native-camera';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

import { colors } from '../../theme';
import PackageService from '../../services/PackageService';
import { CourierStackParamList } from '../../navigation/CourierNavigator';

// Real camera component with fallback to mock
const CameraView: React.FC<{
  onBarCodeRead: (data: { data: string }) => void;
  scanning: boolean;
}> = ({ onBarCodeRead, scanning }) => {
  const [cameraPermission, setCameraPermission] = useState<string | null>(null);
  const [mockScanned, setMockScanned] = useState(false);

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    try {
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.CAMERA 
        : PERMISSIONS.ANDROID.CAMERA;
      
      const result = await request(permission);
      setCameraPermission(result);
    } catch (error) {
      console.log('Camera permission error:', error);
      setCameraPermission(RESULTS.DENIED);
    }
  };

  const simulateScan = () => {
    if (!mockScanned && scanning) {
      setMockScanned(true);
      // Simulate scanning a QR code
      setTimeout(() => {
        onBarCodeRead({ data: 'MOCK_QR_TOKEN_123456789' });
        setMockScanned(false);
      }, 1000);
    }
  };

  // Use real camera if permission granted
  if (cameraPermission === RESULTS.GRANTED) {
    return (
      <RNCamera
        style={styles.camera}
        type={RNCamera.Constants.Type.back}
        flashMode={RNCamera.Constants.FlashMode.auto}
        barCodeTypes={[RNCamera.Constants.BarCodeType.qr]}
        onBarCodeRead={scanning ? onBarCodeRead : undefined}
        captureAudio={false}
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
      </RNCamera>
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
          {cameraPermission === RESULTS.DENIED 
            ? 'Camera permission required for scanning' 
            : 'Position QR code within the frame'}
        </Text>
        {cameraPermission === RESULTS.DENIED ? (
          <TouchableOpacity style={styles.mockScanButton} onPress={requestCameraPermission}>
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

type QRScannerRouteProp = RouteProp<CourierStackParamList, 'QRScanner'>;

const QRScannerScreen: React.FC = () => {
  const route = useRoute<QRScannerRouteProp>();
  const navigation = useNavigation();
  const { agreementId } = route.params || {};
  
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);

  const handleBarCodeRead = async (data: { data: string }) => {
    if (!scanning || processing) return;

    setScanning(false);
    setProcessing(true);

    try {
      const qrToken = data.data;
      
      // TODO: Get current location for verification
      const location: [number, number] = [-74.0060, 40.7128];
      
      const response = await PackageService.verifyDeliveryQR(qrToken, location);
      
      if (response.success) {
        Alert.alert(
          'Delivery Confirmed!',
          'Package delivered successfully. Payment has been released to your account.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.goBack();
                navigation.goBack(); // Go back to courier dashboard
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Verification Failed',
          response.error || 'Invalid QR code or delivery cannot be confirmed.',
          [
            {
              text: 'Try Again',
              onPress: () => {
                setScanning(true);
                setProcessing(false);
              },
            },
            {
              text: 'Cancel',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to verify delivery. Please try again.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              setScanning(true);
              setProcessing(false);
            },
          },
          {
            text: 'Cancel',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    }
  };

  const handleManualEntry = () => {
    Alert.prompt(
      'Manual QR Entry',
      'Enter the QR code manually:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Verify',
          onPress: (qrCode) => {
            if (qrCode) {
              handleBarCodeRead({ data: qrCode });
            }
          },
        },
      ],
      'plain-text'
    );
  };

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView onBarCodeRead={handleBarCodeRead} scanning={scanning} />
      </View>

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="close" size={24} color={colors.text.inverse} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <View style={styles.instructionCard}>
            <Icon name="qr-code-scanner" size={32} color={colors.primary} />
            <Text style={styles.instructionTitle}>Delivery Verification</Text>
            <Text style={styles.instructionText}>
              Ask the recipient to show their QR code and scan it to confirm delivery
            </Text>
          </View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={styles.manualButton}
            onPress={handleManualEntry}
          >
            <Icon name="keyboard" size={20} color={colors.text.inverse} />
            <Text style={styles.manualButtonText}>Manual Entry</Text>
          </TouchableOpacity>

          {processing && (
            <View style={styles.processingIndicator}>
              <Icon name="hourglass-empty" size={20} color={colors.warning} />
              <Text style={styles.processingText}>Verifying delivery...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Safety Information */}
      <View style={styles.safetyInfo}>
        <View style={styles.safetyCard}>
          <Icon name="security" size={20} color={colors.success} />
          <Text style={styles.safetyText}>
            Secure verification ensures payment is only released when delivery is confirmed
          </Text>
        </View>
      </View>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  mockCamera: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanArea: {
    width: width * 0.7,
    height: width * 0.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCorners: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanInstructions: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
  },
  scanText: {
    color: colors.text.inverse,
    fontSize: 16,
    marginBottom: 20,
  },
  mockScanButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  mockScanText: {
    color: colors.text.inverse,
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.inverse,
  },
  instructionsContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  instructionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: width * 0.8,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 8,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomControls: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  manualButtonText: {
    color: colors.text.inverse,
    fontWeight: '600',
    marginLeft: 8,
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  processingText: {
    color: colors.warning,
    marginLeft: 8,
  },
  safetyInfo: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
  },
  safetyText: {
    color: colors.text.inverse,
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
});

export default QRScannerScreen;