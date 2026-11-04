/**
 * @fileoverview Whether a photo shows its person's face clearly enough to be
 *               a profile photo.
 * @author Oabona-Majoko
 * @created 2026-11-04
 * @lastModified 2026-11-04
 *
 * Riders and drivers recognise each other at pickup by their profile photos,
 * so a profile photo is taken with the front camera and must show one face,
 * looking at the camera, large enough to recognise. Gallery pictures (a car,
 * a logo, someone else) are not accepted.
 *
 * The faces come from ML Kit on the phone; this only decides what counts.
 */

/** The parts of an ML Kit face this uses. */
export interface DetectedFace {
  frame: { width: number; height: number };
  /** Head turned left or right, in degrees. */
  rotationY: number;
  /** Head tilted towards a shoulder, in degrees. */
  rotationZ: number;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
}

export type FacePhotoProblem = 'no_face' | 'several_faces' | 'too_far' | 'not_facing' | 'eyes_closed';

/** Smallest share of the photo's width the face must fill. */
const MIN_FACE_WIDTH_SHARE = 0.25;
/** How far the head may turn or tilt, in degrees. */
const MAX_TURN = 25;
const MAX_TILT = 25;
/** ML Kit's estimate below which an eye counts as closed. */
const EYE_OPEN = 0.4;

/**
 * What, if anything, is wrong with the photo.
 *
 * @param faces - What ML Kit found in it
 * @param imageWidth - The photo's width in pixels
 * @returns null when it will do as a profile photo
 */
export function facePhotoProblem(faces: DetectedFace[], imageWidth: number): FacePhotoProblem | null {
  if (faces.length === 0) return 'no_face';
  if (faces.length > 1) return 'several_faces';

  const face = faces[0]!;
  if (imageWidth > 0 && face.frame.width / imageWidth < MIN_FACE_WIDTH_SHARE) return 'too_far';
  if (Math.abs(face.rotationY) > MAX_TURN || Math.abs(face.rotationZ) > MAX_TILT) return 'not_facing';

  const eyes = [face.leftEyeOpenProbability, face.rightEyeOpenProbability].filter(
    (probability): probability is number => typeof probability === 'number',
  );
  if (eyes.length === 2 && eyes.every((probability) => probability < EYE_OPEN)) return 'eyes_closed';

  return null;
}

export default facePhotoProblem;
