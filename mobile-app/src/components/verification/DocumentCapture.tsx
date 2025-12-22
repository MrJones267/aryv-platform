/**
 * @fileoverview Advanced document capture component with auto-detection and quality guidance
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Dimensions,
  Modal,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { DocumentType, DocumentMetadata } from '../../services/DocumentVerificationService';

const { width, height } = Dimensions.get('window');

interface DocumentCaptureProps {
  documentType: DocumentType;
  onCapture: (imageUri: string, metadata: DocumentMetadata) => void;
  onCancel: () => void;
  visible: boolean;
  guidelines?: string[];
}

interface CaptureQuality {
  brightness: 'low' | 'good' | 'high';
  sharpness: 'poor' | 'fair' | 'good';
  angle: 'tilted' | 'straight';
  coverage: 'partial' | 'complete';
  overall: 'poor' | 'fair' | 'good' | 'excellent';
}

interface DocumentBounds {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
  confidence: number;
}

export const DocumentCapture: React.FC<DocumentCaptureProps> = ({
  documentType,
  onCapture,
  onCancel,
  visible,
  guidelines = [],
}) => {
  const cameraRef = useRef<RNCamera>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flashMode, setFlashMode] = useState(RNCamera.Constants.FlashMode.auto);
  const [cameraType, setCameraType] = useState(RNCamera.Constants.Type.back);
  const [quality, setQuality] = useState<CaptureQuality | null>(null);
  const [documentBounds, setDocumentBounds] = useState<DocumentBounds | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [autoCapture, setAutoCapture] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      // Reset state when modal opens
      setCapturedImage(null);
      setQuality(null);
      setDocumentBounds(null);
      setShowGuidelines(true);
      setCountdown(null);
    }
  }, [visible]);

  useEffect(() => {
    // Auto-capture countdown
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      handleCapture();
      setCountdown(null);
    }
  }, [countdown]);

  const getDocumentGuidelines = (): string[] => {
    const baseGuidelines = [
      'Place document on a flat, dark surface',
      'Ensure good lighting without shadows',
      'Keep camera steady and parallel to document',
      'Make sure all corners are visible',
      'Avoid glare and reflections',
    ];

    const specificGuidelines: Record<DocumentType, string[]> = {
      drivers_license: [
        'Capture both front and back sides',
        'Ensure license is not expired',
        'Make sure photo and text are clearly visible',
      ],
      passport: [
        'Capture the photo page only',
        'Ensure passport is open flat',
        'Make sure the photo and all text are clear',
      ],
      vehicle_registration: [
        'Capture the main information page',
        'Ensure all vehicle details are visible',
        'Make sure document is current',
      ],
      insurance_card: [
        'Capture both sides if applicable',
        'Ensure policy dates are clearly visible',
        'Make sure coverage information is readable',
      ],
      national_id: [
        'Capture both front and back',
        'Ensure ID number is clearly visible',
        'Make sure photo and text are not blurred',
      ],
      background_check: [
        'Capture all pages of the report',
        'Ensure document is from approved provider',
        'Make sure all text is clearly readable',
      ],
      bank_statement: [
        'Capture the first page with account details',
        'Ensure statement is recent (within 3 months)',
        'Account holder name must be visible',
      ],
      utility_bill: [
        'Capture the page showing account details',
        'Ensure bill is recent (within 3 months)',
        'Service address must be clearly visible',
      ],
    };

    return [...baseGuidelines, ...(specificGuidelines[documentType] || []), ...guidelines];
  };

  const analyzeImageQuality = (imageUri: string): Promise<CaptureQuality> => {
    // In production, this would use actual image analysis
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockQuality: CaptureQuality = {
          brightness: Math.random() > 0.3 ? 'good' : Math.random() > 0.5 ? 'high' : 'low',
          sharpness: Math.random() > 0.2 ? 'good' : Math.random() > 0.5 ? 'fair' : 'poor',
          angle: Math.random() > 0.2 ? 'straight' : 'tilted',
          coverage: Math.random() > 0.1 ? 'complete' : 'partial',
          overall: 'good',
        };

        // Determine overall quality
        const scores = {
          brightness: mockQuality.brightness === 'good' ? 2 : mockQuality.brightness === 'high' ? 1 : 0,
          sharpness: mockQuality.sharpness === 'good' ? 2 : mockQuality.sharpness === 'fair' ? 1 : 0,
          angle: mockQuality.angle === 'straight' ? 2 : 0,
          coverage: mockQuality.coverage === 'complete' ? 2 : 0,
        };

        const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
        const maxScore = 8;

        if (totalScore >= 7) mockQuality.overall = 'excellent';
        else if (totalScore >= 5) mockQuality.overall = 'good';
        else if (totalScore >= 3) mockQuality.overall = 'fair';
        else mockQuality.overall = 'poor';

        resolve(mockQuality);
      }, 1000);
    });
  };

  const detectDocumentBounds = (): Promise<DocumentBounds | null> => {
    // Mock document detection - in production would use computer vision
    return new Promise((resolve) => {
      setTimeout(() => {
        if (Math.random() > 0.3) {
          const bounds: DocumentBounds = {
            topLeft: { x: 50, y: 100 },
            topRight: { x: width - 50, y: 100 },
            bottomLeft: { x: 50, y: 300 },
            bottomRight: { x: width - 50, y: 300 },
            confidence: 0.8 + Math.random() * 0.2,
          };
          resolve(bounds);
        } else {
          resolve(null);
        }
      }, 500);
    });
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      
      const options = {
        quality: 0.8,
        base64: false,
        skipProcessing: false,
        width: 1920,
        height: 1080,
      };

      const data = await cameraRef.current.takePictureAsync(options);
      setCapturedImage(data.uri);
      
      // Analyze image quality
      const imageQuality = await analyzeImageQuality(data.uri);
      setQuality(imageQuality);

      // If quality is poor, offer retake option
      if (imageQuality.overall === 'poor') {
        Alert.alert(
          'Image Quality Warning',
          'The captured image may not meet quality standards. Would you like to retake it?',
          [
            { text: 'Retake', onPress: () => setCapturedImage(null) },
            { text: 'Use Anyway', onPress: () => handleConfirmCapture(data.uri) },
          ]
        );
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Capture Error', 'Failed to capture image. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleConfirmCapture = (imageUri: string) => {
    const metadata: DocumentMetadata = {
      captureTimestamp: new Date().toISOString(),
      deviceInfo: `Camera capture - ${documentType}`,
      imageQuality: quality?.overall === 'excellent' || quality?.overall === 'good' ? 'high' : 
                   quality?.overall === 'fair' ? 'medium' : 'low',
      fileSize: 0, // Would be calculated from actual file
      fileName: `${documentType}_${Date.now()}.jpg`,
      location: undefined, // Could include GPS coordinates if permissions granted
    };

    onCapture(imageUri, metadata);
  };

  const handleFlashToggle = () => {
    setFlashMode((current: any) => {
      switch (current) {
        case RNCamera.Constants.FlashMode.auto:
          return RNCamera.Constants.FlashMode.on;
        case RNCamera.Constants.FlashMode.on:
          return RNCamera.Constants.FlashMode.off;
        default:
          return RNCamera.Constants.FlashMode.auto;
      }
    });
  };

  const handleAutoCapture = async () => {
    setAutoCapture(true);
    
    // Detect document bounds
    const bounds = await detectDocumentBounds();
    setDocumentBounds(bounds);
    
    if (bounds && bounds.confidence > 0.7) {
      // Start countdown for auto capture
      setCountdown(3);
    } else {
      setAutoCapture(false);
      Alert.alert(
        'Document Not Detected',
        'Please position your document clearly within the frame and try again.'
      );
    }
  };

  const getFlashIcon = (): string => {
    switch (flashMode) {
      case RNCamera.Constants.FlashMode.on:
        return 'flash-on';
      case RNCamera.Constants.FlashMode.off:
        return 'flash-off';
      default:
        return 'flash-auto';
    }
  };

  const renderCameraView = () => (
    <View style={styles.cameraContainer}>
      <RNCamera
        ref={cameraRef}
        style={styles.camera}
        type={cameraType}
        flashMode={flashMode}
        captureAudio={false}
        androidCameraPermissionOptions={{
          title: 'Permission to use camera',
          message: 'We need your permission to take photos of your documents',
          buttonPositive: 'Ok',
          buttonNegative: 'Cancel',
        }}
      >
        {/* Document frame overlay */}
        <View style={styles.overlay}>
          <View style={styles.frameContainer}>
            <View style={styles.documentFrame} />
            {documentBounds && (
              <View style={[styles.detectedBounds, {
                left: documentBounds.topLeft.x,
                top: documentBounds.topLeft.y,
                width: documentBounds.topRight.x - documentBounds.topLeft.x,
                height: documentBounds.bottomLeft.y - documentBounds.topLeft.y,
              }]} />
            )}
          </View>
          
          {/* Instructions */}
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>
              Position your {documentType.replace('_', ' ')} within the frame
            </Text>
            {quality && (
              <View style={styles.qualityIndicator}>
                <Icon 
                  name={quality.overall === 'excellent' || quality.overall === 'good' ? 'check-circle' : 'warning'} 
                  size={20} 
                  color={quality.overall === 'excellent' || quality.overall === 'good' ? '#4CAF50' : '#FF9800'} 
                />
                <Text style={[styles.qualityText, {
                  color: quality.overall === 'excellent' || quality.overall === 'good' ? '#4CAF50' : '#FF9800'
                }]}>
                  {quality.overall.charAt(0).toUpperCase() + quality.overall.slice(1)} Quality
                </Text>
              </View>
            )}
          </View>

          {/* Countdown for auto capture */}
          {countdown !== null && countdown > 0 && (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          )}
        </View>

        {/* Camera controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity style={styles.controlButton} onPress={handleFlashToggle}>
            <Icon name={getFlashIcon()} size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.captureButton, isCapturing && styles.capturingButton]}
            onPress={handleCapture}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButton} 
            onPress={handleAutoCapture}
            disabled={autoCapture}
          >
            <Icon name="center-focus-weak" size={24} color={autoCapture ? '#FF9800' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>
      </RNCamera>

      {/* Guidelines overlay */}
      {showGuidelines && (
        <View style={styles.guidelinesOverlay}>
          <View style={styles.guidelinesContainer}>
            <View style={styles.guidelinesHeader}>
              <Text style={styles.guidelinesTitle}>Document Capture Tips</Text>
              <TouchableOpacity onPress={() => setShowGuidelines(false)}>
                <Icon name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.guidelinesList}>
              {getDocumentGuidelines().map((guideline, index) => (
                <View key={index} style={styles.guidelineItem}>
                  <Icon name="check-circle" size={16} color="#4CAF50" />
                  <Text style={styles.guidelineText}>{guideline}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.gotItButton}
              onPress={() => setShowGuidelines(false)}
            >
              <Text style={styles.gotItText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderImagePreview = () => (
    <View style={styles.previewContainer}>
      <Image source={{ uri: capturedImage! }} style={styles.previewImage} />
      
      {/* Quality assessment */}
      {quality && (
        <View style={styles.qualityAssessment}>
          <Text style={styles.assessmentTitle}>Image Quality Assessment</Text>
          
          <View style={styles.qualityMetrics}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Brightness:</Text>
              <Text style={[styles.metricValue, {
                color: quality.brightness === 'good' ? '#4CAF50' : '#FF9800'
              }]}>
                {quality.brightness}
              </Text>
            </View>
            
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Sharpness:</Text>
              <Text style={[styles.metricValue, {
                color: quality.sharpness === 'good' ? '#4CAF50' : '#FF9800'
              }]}>
                {quality.sharpness}
              </Text>
            </View>
            
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Alignment:</Text>
              <Text style={[styles.metricValue, {
                color: quality.angle === 'straight' ? '#4CAF50' : '#FF9800'
              }]}>
                {quality.angle}
              </Text>
            </View>
            
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Coverage:</Text>
              <Text style={[styles.metricValue, {
                color: quality.coverage === 'complete' ? '#4CAF50' : '#FF9800'
              }]}>
                {quality.coverage}
              </Text>
            </View>
          </View>
          
          <View style={styles.overallQuality}>
            <Icon 
              name={quality.overall === 'excellent' || quality.overall === 'good' ? 'check-circle' : 'warning'} 
              size={24} 
              color={quality.overall === 'excellent' || quality.overall === 'good' ? '#4CAF50' : '#FF9800'} 
            />
            <Text style={styles.overallText}>
              Overall: {quality.overall.charAt(0).toUpperCase() + quality.overall.slice(1)}
            </Text>
          </View>
        </View>
      )}

      {/* Preview controls */}
      <View style={styles.previewControls}>
        <TouchableOpacity 
          style={[styles.previewButton, styles.retakeButton]}
          onPress={() => setCapturedImage(null)}
        >
          <Icon name="refresh" size={20} color="#666666" />
          <Text style={styles.retakeText}>Retake</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.previewButton, styles.useButton]}
          onPress={() => handleConfirmCapture(capturedImage!)}
        >
          <Icon name="check" size={20} color="#FFFFFF" />
          <Text style={styles.useText}>Use Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Icon name="close" size={24} color="#333333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Capture {documentType.replace('_', ' ')}
          </Text>
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => setShowGuidelines(true)}
          >
            <Icon name="help-outline" size={24} color="#2196F3" />
          </TouchableOpacity>
        </View>
        
        {capturedImage ? renderImagePreview() : renderCameraView()}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  cancelButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  helpButton: {
    padding: 8,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  frameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  documentFrame: {
    width: '100%',
    aspectRatio: 1.6, // Typical document aspect ratio
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  detectedBounds: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#4CAF50',
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  instructionContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  qualityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    gap: 6,
  },
  qualityText: {
    fontSize: 14,
    fontWeight: '500',
  },
  countdownContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  capturingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2196F3',
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    width: '100%',
    resizeMode: 'contain',
  },
  qualityAssessment: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
  },
  assessmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
    textAlign: 'center',
  },
  qualityMetrics: {
    gap: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666666',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  overallQuality: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 8,
  },
  overallText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  previewControls: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 16,
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  retakeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  useButton: {
    backgroundColor: '#2196F3',
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  useText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  guidelinesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  guidelinesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    maxHeight: '80%',
  },
  guidelinesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  guidelinesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  guidelinesList: {
    maxHeight: 300,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  guidelineText: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
    lineHeight: 20,
  },
  gotItButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  gotItText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default DocumentCapture;