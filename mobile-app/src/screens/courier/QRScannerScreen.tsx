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
  TextInput,
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

/** Mirrors CODE_ALPHABET in the backend's DeliveryHandoverService. */
const HANDOVER_CODE_PATTERN = /^[ACDEFGHJKLMNPQRTUVWXYZ234679]{6}$/;

const QRScannerScreen: React.FC = () => {
  const route = useRoute<QRScannerScreenRouteProp>();
  const navigation = useNavigation();
  const { agreementId } = route.params || {};
  
  const [scanning, setScanning] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBarCodeRead = async (data: { data: string }) => {
    if (!scanning) return;

    setScanning(false);
    setScannedData(data.data);

    try {
      // A handover code is six characters from an unambiguous alphabet. The
      // previous check required an 'ARYV_QR_' prefix that the server has never
      // produced, so nothing a recipient could show would have passed it.
      const scanned = (data.data || '').trim().toUpperCase();
      if (!HANDOVER_CODE_PATTERN.test(scanned)) {
        Alert.alert(
          'Not a delivery code',
          'That is not an ARYV delivery code. Ask the recipient for the six-character code from their SMS.',
        );
        setScanning(true);
        return;
      }

      // Get current location for verification
      const currentLocation = await LocationService.getCurrentLocation();

      // Verify delivery with backend
      const result = await PackageService.verifyDeliveryQR(
        scanned,
        [currentLocation.latitude, currentLocation.longitude],
      );

      if (result.success) {
        const resultData = result.data as Record<string, unknown> | undefined;
        Alert.alert(
          'Delivery confirmed',
          `Payment released${resultData?.courierEarnings ? `: ${resultData.courierEarnings}` : ''}.`,
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
        Alert.alert('Could not confirm', result.error || 'That code was not accepted.');
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

  /**
   * Manual entry is the path that matters. The code reaches the recipient by
   * SMS as text, so in practice they read it out and the courier types it —
   * scanning only helps if the recipient happens to display it as a QR.
   */
  const submitManualCode = async (): Promise<void> => {
    const code = manualCode.trim().toUpperCase();

    if (!HANDOVER_CODE_PATTERN.test(code)) {
      Alert.alert(
        'Check the code',
        'Delivery codes are six characters, letters and numbers, from the recipient\'s SMS.',
      );
      return;
    }

    setSubmitting(true);
    try {
      await handleBarCodeRead({ data: code });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm delivery</Text>
        <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
          <Icon name={flashOn ? "flash-on" : "flash-off"} size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <CameraView 
        onBarCodeRead={handleBarCodeRead} 
        scanning={scanning} 
        agreementId={agreementId}
      />

      <View style={styles.manualEntry}>
        <Text style={styles.manualLabel}>Enter the recipient's code</Text>
        <Text style={styles.manualHint}>
          Collect the cash, hand over the package, then ask the recipient for
          the six-character code in their SMS. Entering it completes the
          delivery — do not enter it before you have been paid.
        </Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            value={manualCode}
            onChangeText={(text) => setManualCode(text.toUpperCase())}
            placeholder="A1B2C3"
            placeholderTextColor={colors.text.secondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            editable={!submitting}
            accessibilityLabel="Delivery code"
          />
          <TouchableOpacity
            style={[styles.manualSubmit, submitting && styles.manualSubmitDisabled]}
            onPress={submitManualCode}
            disabled={submitting}
            accessibilityRole="button"
          >
            <Text style={styles.manualSubmitText}>
              {submitting ? 'Checking…' : 'Confirm'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
  manualEntry: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background.primary,
  },
  manualLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  manualHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.text.primary,
    marginRight: 12,
  },
  manualSubmit: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  manualSubmitDisabled: {
    opacity: 0.6,
  },
  manualSubmitText: {
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 15,
  },
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