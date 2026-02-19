/**
 * @fileoverview File upload component for documents and images
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, launchCamera, Asset } from 'react-native-image-picker';
import { colors } from '../../theme';

export interface FileUploadProps {
  onFileSelected: (file: Asset) => void;
  onUploadComplete?: (url: string) => void;
  onError?: (error: string) => void;
  accept?: 'image' | 'document' | 'any';
  maxSize?: number; // in MB
  label?: string;
  placeholder?: string;
  showPreview?: boolean;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelected,
  onUploadComplete,
  onError,
  accept = 'image',
  maxSize = 10,
  label,
  placeholder = 'Tap to select a file',
  showPreview = true,
  disabled = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<Asset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSelectFile = async (useCamera: boolean = false) => {
    if (disabled) return;

    try {
      const options = {
        mediaType: accept === 'image' ? 'photo' as const : 'mixed' as const,
        quality: 0.8 as const,
        maxWidth: 1920,
        maxHeight: 1920,
      };

      const result = useCamera
        ? await launchCamera(options)
        : await launchImageLibrary(options);

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        onError?.(result.errorMessage || 'Failed to select file');
        return;
      }

      const file = result.assets?.[0];
      if (!file) {
        onError?.('No file selected');
        return;
      }

      // Check file size
      const fileSizeMB = (file.fileSize || 0) / (1024 * 1024);
      if (fileSizeMB > maxSize) {
        onError?.(`File size exceeds ${maxSize}MB limit`);
        return;
      }

      setSelectedFile(file);
      onFileSelected(file);

      // Simulate upload (in production, upload to server)
      if (onUploadComplete) {
        setIsUploading(true);
        setUploadProgress(0);

        // Simulate upload progress
        const interval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              setIsUploading(false);
              onUploadComplete(file.uri || '');
              return 100;
            }
            return prev + 20;
          });
        }, 200);
      }
    } catch (error: unknown) {
      onError?.(error instanceof Error ? error.message : 'Failed to select file');
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setUploadProgress(0);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {selectedFile && showPreview ? (
        <View style={styles.previewContainer}>
          {selectedFile.type?.startsWith('image') ? (
            <Image source={{ uri: selectedFile.uri }} style={styles.preview} />
          ) : (
            <View style={styles.filePreview}>
              <Icon name="insert-drive-file" size={40} color={colors.primary} />
              <Text style={styles.fileName} numberOfLines={1}>
                {selectedFile.fileName || 'Selected file'}
              </Text>
            </View>
          )}

          {isUploading ? (
            <View style={styles.progressOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.progressText}>{uploadProgress}%</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
              <Icon name="close" size={20} color={colors.text.inverse} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.uploadContainer}>
          <TouchableOpacity
            style={[styles.uploadButton, disabled && styles.disabled]}
            onPress={() => handleSelectFile(false)}
            disabled={disabled}
          >
            <Icon name="cloud-upload" size={32} color={colors.primary} />
            <Text style={styles.placeholder}>{placeholder}</Text>
          </TouchableOpacity>

          {accept === 'image' && (
            <TouchableOpacity
              style={[styles.cameraButton, disabled && styles.disabled]}
              onPress={() => handleSelectFile(true)}
              disabled={disabled}
            >
              <Icon name="camera-alt" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  uploadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadButton: {
    flex: 1,
    height: 120,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border.light,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
  },
  placeholder: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
  },
  cameraButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  previewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  filePreview: {
    height: 120,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fileName: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 8,
  },
});

export default FileUpload;
