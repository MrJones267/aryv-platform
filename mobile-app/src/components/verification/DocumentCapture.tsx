/**
 * @fileoverview Document capture component using image picker
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Modal,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { launchCamera, launchImageLibrary, CameraOptions } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { DocumentType, DocumentMetadata } from '../../services/DocumentVerificationService';
import { colors } from '../../theme';

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

export const DocumentCapture: React.FC<DocumentCaptureProps> = ({
  documentType,
  onCapture,
  onCancel,
  visible,
  guidelines = [],
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [quality, setQuality] = useState<CaptureQuality | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(true);

  useEffect(() => {
    if (visible) {
      setCapturedImage(null);
      setQuality(null);
      setShowGuidelines(true);
    }
  }, [visible]);

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

  const analyzeImageQuality = (): CaptureQuality => {
    // Mock quality analysis - in production would use actual image analysis
    return {
      brightness: 'good',
      sharpness: 'good',
      angle: 'straight',
      coverage: 'complete',
      overall: 'good',
    };
  };

  const handleCapture = async (useCamera: boolean) => {
    setIsCapturing(true);

    const options: CameraOptions = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1080,
      saveToPhotos: false,
    };

    try {
      const result = useCamera
        ? await launchCamera(options)
        : await launchImageLibrary(options);

      if (result.didCancel) {
        setIsCapturing(false);
        return;
      }

      if (result.errorCode) {
        Alert.alert('Error', result.errorMessage || 'Failed to capture image');
        setIsCapturing(false);
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.uri) {
        setCapturedImage(asset.uri);
        const imageQuality = analyzeImageQuality();
        setQuality(imageQuality);
      }
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to capture image');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleConfirmCapture = () => {
    if (!capturedImage) return;

    const metadata: DocumentMetadata = {
      captureTimestamp: new Date().toISOString(),
      deviceInfo: `Document capture - ${documentType}`,
      imageQuality: quality?.overall === 'excellent' || quality?.overall === 'good' ? 'high' :
                   quality?.overall === 'fair' ? 'medium' : 'low',
      fileSize: 0,
      fileName: `${documentType}_${Date.now()}.jpg`,
      location: undefined,
    };

    onCapture(capturedImage, metadata);
  };

  const renderCaptureOptions = () => (
    <View style={styles.captureOptions}>
      <Text style={styles.title}>
        Capture {documentType.replace(/_/g, ' ')}
      </Text>

      <Text style={styles.subtitle}>
        Choose how to capture your document
      </Text>

      <TouchableOpacity
        style={styles.optionButton}
        onPress={() => handleCapture(true)}
        disabled={isCapturing}
      >
        <View style={styles.optionIcon}>
          <Icon name="camera-alt" size={32} color={colors.primary} />
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Take Photo</Text>
          <Text style={styles.optionDescription}>Use your camera to capture the document</Text>
        </View>
        <Icon name="chevron-right" size={24} color={colors.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.optionButton}
        onPress={() => handleCapture(false)}
        disabled={isCapturing}
      >
        <View style={styles.optionIcon}>
          <Icon name="photo-library" size={32} color={colors.primary} />
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Choose from Gallery</Text>
          <Text style={styles.optionDescription}>Select an existing photo</Text>
        </View>
        <Icon name="chevron-right" size={24} color={colors.text.secondary} />
      </TouchableOpacity>

      {isCapturing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </View>
  );

  const renderGuidelines = () => (
    <View style={styles.guidelinesContainer}>
      <Text style={styles.guidelinesTitle}>Tips for best results</Text>
      <ScrollView style={styles.guidelinesList}>
        {getDocumentGuidelines().map((guideline, index) => (
          <View key={index} style={styles.guidelineItem}>
            <Icon name="check-circle" size={16} color={colors.success} />
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
  );

  const renderImagePreview = () => (
    <View style={styles.previewContainer}>
      <Image source={{ uri: capturedImage! }} style={styles.previewImage} />

      {quality && (
        <View style={styles.qualityBadge}>
          <Icon
            name={quality.overall === 'excellent' || quality.overall === 'good' ? 'check-circle' : 'warning'}
            size={20}
            color={quality.overall === 'excellent' || quality.overall === 'good' ? colors.success : colors.warning}
          />
          <Text style={styles.qualityText}>
            {quality.overall.charAt(0).toUpperCase() + quality.overall.slice(1)} Quality
          </Text>
        </View>
      )}

      <View style={styles.previewControls}>
        <TouchableOpacity
          style={[styles.previewButton, styles.retakeButton]}
          onPress={() => setCapturedImage(null)}
        >
          <Icon name="refresh" size={20} color={colors.text.secondary} />
          <Text style={styles.retakeText}>Retake</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.previewButton, styles.useButton]}
          onPress={handleConfirmCapture}
        >
          <Icon name="check" size={20} color={colors.text.inverse} />
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
          <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
            <Icon name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Document Capture</Text>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => setShowGuidelines(true)}
          >
            <Icon name="help-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {showGuidelines && !capturedImage && renderGuidelines()}
          {!showGuidelines && !capturedImage && renderCaptureOptions()}
          {capturedImage && renderImagePreview()}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  helpButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: 24,
  },
  captureOptions: {
    flex: 1,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidelinesContainer: {
    flex: 1,
  },
  guidelinesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 16,
  },
  guidelinesList: {
    flex: 1,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  guidelineText: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },
  gotItButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  gotItText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    borderRadius: 12,
    resizeMode: 'contain',
  },
  qualityBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  qualityText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  previewControls: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  retakeButton: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  useButton: {
    backgroundColor: colors.primary,
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  useText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});

export default DocumentCapture;
