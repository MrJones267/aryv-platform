/**
 * @fileoverview What counts as a usable profile photo
 * @author Oabona-Majoko
 * @created 2026-11-04
 * @lastModified 2026-11-04
 */

import { facePhotoProblem, DetectedFace } from '../facePhoto';

const face = (overrides: Partial<DetectedFace> = {}): DetectedFace => ({
  frame: { width: 400, height: 480 },
  rotationY: 0,
  rotationZ: 0,
  leftEyeOpenProbability: 0.95,
  rightEyeOpenProbability: 0.92,
  ...overrides,
});

describe('facePhotoProblem', () => {
  it('accepts one clear face looking at the camera', () => {
    expect(facePhotoProblem([face()], 1024)).toBeNull();
  });

  it('refuses a photo with no face (a car, a logo, a wall)', () => {
    expect(facePhotoProblem([], 1024)).toBe('no_face');
  });

  it('refuses a group photo', () => {
    expect(facePhotoProblem([face(), face()], 1024)).toBe('several_faces');
  });

  it('refuses a face too small to recognise', () => {
    expect(facePhotoProblem([face({ frame: { width: 150, height: 180 } })], 1024)).toBe('too_far');
  });

  it('refuses a face turned away or tilted', () => {
    expect(facePhotoProblem([face({ rotationY: 40 })], 1024)).toBe('not_facing');
    expect(facePhotoProblem([face({ rotationZ: -35 })], 1024)).toBe('not_facing');
  });

  it('refuses closed eyes, but not when ML Kit cannot tell', () => {
    expect(facePhotoProblem([face({ leftEyeOpenProbability: 0.1, rightEyeOpenProbability: 0.05 })], 1024)).toBe('eyes_closed');
    expect(facePhotoProblem([face({ leftEyeOpenProbability: undefined, rightEyeOpenProbability: undefined })], 1024)).toBeNull();
  });
});
