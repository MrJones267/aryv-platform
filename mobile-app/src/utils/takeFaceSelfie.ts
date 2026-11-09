/**
 * @fileoverview Take a face photo with the front camera, checked on the phone
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 *
 * Used for the photo from today that a passenger takes when booking and a
 * driver when accepting, so each can check who is getting into the car. The
 * same rules as a profile photo: front camera only, never the gallery, and
 * one face, close enough, looking at the camera, eyes open.
 */

import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import FaceDetection from '@react-native-ml-kit/face-detection';
import { facePhotoProblem, FacePhotoProblem } from './facePhoto';
import logger from '../services/LoggingService';
import type { TranslationKey } from '../i18n/translations';

const log = logger.createLogger('takeFaceSelfie');

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

const FACE_PROBLEM_TEXT: Record<FacePhotoProblem, TranslationKey> = {
  no_face: 'photo.noFace',
  several_faces: 'photo.severalFaces',
  too_far: 'photo.tooFar',
  not_facing: 'photo.notFacing',
  eyes_closed: 'photo.eyesClosed',
};

/** Resolves once the person picks one of the alert's buttons. */
const ask = (title: string, message: string, retry: string, cancel: string): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: retry, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });

/**
 * Open the front camera and return the photo's local URI once it shows one
 * face clearly. Offers a retake when it does not.
 *
 * @param t - The screen's translator
 * @param purpose - Shown before the camera opens, saying why the photo is needed
 * @returns the photo's URI, or null if the person cancelled or it failed
 */
export const takeFaceSelfie = async (t: Translate, purpose: string): Promise<string | null> => {
  const go = await ask(t('tripPhoto.title'), purpose, t('rf.takePhoto'), t('common.cancel'));
  if (!go) {return null;}

  for (;;) {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          const open = await ask(t('photo.faceTitle'), t('tripPhoto.cameraNeeded'), t('perm.openSettings'), t('common.cancel'));
          if (open) {Linking.openSettings().catch(() => undefined);}
          return null;
        }
      }

      const result = await launchCamera({
        mediaType: 'photo',
        cameraType: 'front',
        quality: 0.7,
        maxWidth: 800,
        maxHeight: 800,
        includeBase64: false,
        saveToPhotos: false,
      });
      if (result.errorCode) {
        log.warn('Camera failed', { code: result.errorCode, message: result.errorMessage });
        Alert.alert(t('common.error'), t('st.failedToSelectPhotoPlease'));
        return null;
      }
      const asset = result.assets?.[0];
      if (result.didCancel || !asset?.uri) {return null;}

      const faces = await FaceDetection.detect(asset.uri, { performanceMode: 'accurate', classificationMode: 'all' });
      const problem = facePhotoProblem(faces, asset.width ?? 0);
      if (!problem) {return asset.uri;}

      const again = await ask(t('photo.faceTitle'), t(FACE_PROBLEM_TEXT[problem]), t('photo.retake'), t('common.cancel'));
      if (!again) {return null;}
    } catch (error) {
      log.warn('Could not take a trip photo', error);
      Alert.alert(t('common.error'), t('st.failedToSelectPhotoPlease'));
      return null;
    }
  }
};

export default takeFaceSelfie;
