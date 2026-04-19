/**
 * @fileoverview Image picker component for package photos
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  CameraOptions,
  ImageLibraryOptions,
} from 'react-native-image-picker';

import { colors } from '../../theme';

interface ImagePickerProps {
  onImagesSelected: (images: string[]) => void;
  maxImages?: number;
  existingImages?: string[];
  placeholder?: string;
}

const ImagePicker: React.FC<ImagePickerProps> = ({
  onImagesSelected,
  maxImages = 5,
  existingImages = [],
  placeholder = "Add photos of your package"
}) => {
  const [selectedImages, setSelectedImages] = useState<string[]>(existingImages);

  const handleAddImage = () => {
    if (selectedImages.length >= maxImages) {
      Alert.alert('Limit Reached', `You can only add up to ${maxImages} images.`);
      return;
    }

    Alert.alert(
      'Add Photo',
      'Choose how to add a photo of your package',
      [
        {
          text: 'Camera',
          onPress: () => openImagePicker('camera'),
        },
        {
          text: 'Gallery',
          onPress: () => openImagePicker('gallery'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handlePickerResponse = (response: ImagePickerResponse) => {
    if (response.didCancel || response.errorCode) {
      if (response.errorCode && response.errorCode !== 'camera_unavailable') {
        Alert.alert('Error', response.errorMessage || 'Failed to select image.');
      }
      return;
    }
    const asset = response.assets?.[0];
    if (asset?.uri) {
      const newImages = [...selectedImages, asset.uri];
      setSelectedImages(newImages);
      onImagesSelected(newImages);
    }
  };

  const openImagePicker = (source: 'camera' | 'gallery') => {
    const sharedOptions = {
      mediaType: 'photo' as const,
      quality: 0.8 as const,
      maxWidth: 1200,
      maxHeight: 1200,
    };

    if (source === 'camera') {
      const options: CameraOptions = { ...sharedOptions, saveToPhotos: false };
      launchCamera(options, handlePickerResponse);
    } else {
      const options: ImageLibraryOptions = { ...sharedOptions, selectionLimit: 1 };
      launchImageLibrary(options, handlePickerResponse);
    }
  };

  const handleRemoveImage = (index: number) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const newImages = selectedImages.filter((_, i) => i !== index);
            setSelectedImages(newImages);
            onImagesSelected(newImages);
          },
        },
      ]
    );
  };

  const renderImageItem = (uri: string, index: number) => (
    <View key={index} style={styles.imageContainer}>
      <Image source={{ uri }} style={styles.image} />
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveImage(index)}
      >
        <Icon name="close" size={16} color={colors.text.inverse} />
      </TouchableOpacity>
    </View>
  );

  const renderAddButton = () => (
    <TouchableOpacity
      style={styles.addImageButton}
      onPress={handleAddImage}
    >
      <Icon name="add-a-photo" size={32} color={colors.text.secondary} />
      <Text style={styles.addImageText}>Add Photo</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Package Photos</Text>
      <Text style={styles.description}>{placeholder}</Text>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.imageScroll}
        contentContainerStyle={styles.imageScrollContent}
      >
        {selectedImages.map(renderImageItem)}
        
        {selectedImages.length < maxImages && renderAddButton()}
      </ScrollView>

      <View style={styles.imageInfo}>
        <View style={styles.imageCount}>
          <Icon name="photo" size={16} color={colors.text.secondary} />
          <Text style={styles.imageCountText}>
            {selectedImages.length} / {maxImages} photos
          </Text>
        </View>
        
        <Text style={styles.imageHint}>
          Clear photos help couriers identify your package
        </Text>
      </View>

      {selectedImages.length > 0 && (
        <View style={styles.tipContainer}>
          <Icon name="lightbulb" size={16} color={colors.warning} />
          <Text style={styles.tipText}>
            Include photos showing packaging, size, and any identifying marks
          </Text>
        </View>
      )}
    </View>
  );
};

const { width } = Dimensions.get('window');
const imageSize = (width - 64) / 3; // 3 images per row with padding

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  imageScroll: {
    marginBottom: 12,
  },
  imageScrollContent: {
    paddingRight: 16,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  image: {
    width: imageSize,
    height: imageSize,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  addImageButton: {
    width: imageSize,
    height: imageSize,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border.light,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  imageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  imageCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageCountText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  imageHint: {
    fontSize: 12,
    color: colors.text.secondary,
    flex: 1,
    textAlign: 'right',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warning + '20',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  tipText: {
    fontSize: 12,
    color: colors.warning,
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
});

export default ImagePicker;