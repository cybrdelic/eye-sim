import * as THREE from 'three';
import { DIGITAL_TWIN_TUNING } from './config';
import { clamp, remapRange } from './math';
import type { FaceLandmarkPoint, TrackedEyePose } from './types';

function readLandmark(result: FaceLandmarkPoint[] | undefined, index: number) {
  return result?.[index] ?? null;
}

export function estimateFaceProximity(landmarks: FaceLandmarkPoint[] | undefined) {
  const leftCheek = readLandmark(landmarks, 234);
  const rightCheek = readLandmark(landmarks, 454);
  const forehead = readLandmark(landmarks, 10);
  const chin = readLandmark(landmarks, 152);
  const leftEyeOuter = readLandmark(landmarks, 33);
  const rightEyeOuter = readLandmark(landmarks, 263);

  if (!leftCheek || !rightCheek || !forehead || !chin || !leftEyeOuter || !rightEyeOuter) {
    return 0.5;
  }

  const faceWidth = Math.max(Math.abs(rightCheek.x - leftCheek.x), 1e-5);
  const faceHeight = Math.max(Math.abs(chin.y - forehead.y), 1e-5);
  const eyeWidth = Math.max(Math.abs(rightEyeOuter.x - leftEyeOuter.x), 1e-5);
  const weightedSize = faceWidth * 0.46 + faceHeight * 0.36 + eyeWidth * 0.18;

  return remapRange(weightedSize, 0.22, 0.56);
}

export function estimateEyePose(
  landmarks: FaceLandmarkPoint[] | undefined,
  irisIndex: number,
  outerIndex: number,
  innerIndex: number,
  upperIndex: number,
  lowerIndex: number,
): TrackedEyePose {
  const iris = readLandmark(landmarks, irisIndex);
  const outer = readLandmark(landmarks, outerIndex);
  const inner = readLandmark(landmarks, innerIndex);
  const upper = readLandmark(landmarks, upperIndex);
  const lower = readLandmark(landmarks, lowerIndex);

  if (!iris || !outer || !inner || !upper || !lower) {
    return { yaw: 0, pitch: 0 };
  }

  const horizontalSpan = Math.max(Math.abs(inner.x - outer.x), 1e-4);
  const verticalSpan = Math.max(Math.abs(lower.y - upper.y), 1e-4);

  const horizontalCenter = (outer.x + inner.x) * 0.5;
  const verticalCenter = (upper.y + lower.y) * 0.5;

  const horizontal = clamp((iris.x - horizontalCenter) / horizontalSpan, -0.6, 0.6);
  const vertical = clamp((iris.y - verticalCenter) / verticalSpan, -0.8, 0.8);

  return {
    yaw: clamp(horizontal * 1.2 * DIGITAL_TWIN_TUNING.gazeYawSign, -0.45, 0.45),
    pitch: clamp(vertical * 0.9 * DIGITAL_TWIN_TUNING.gazePitchSign, -0.3, 0.3),
  };
}

export function extractHeadRotation(matrixData: number[] | Float32Array | undefined) {
  if (!matrixData || matrixData.length < 16) {
    return { pitch: 0, yaw: 0, roll: 0 };
  }

  const matrix = new THREE.Matrix4().fromArray(Array.from(matrixData));
  const rotationMatrix = new THREE.Matrix4().extractRotation(matrix);
  const rotation = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation).normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);

  const yawBase = Math.atan2(forward.x, Math.max(-forward.z, 1e-6));
  const pitchBase = Math.atan2(forward.y, Math.max(Math.hypot(forward.x, forward.z), 1e-6));

  const referenceUp = worldUp.clone().addScaledVector(forward, -worldUp.dot(forward));
  const projectedUp = up.clone().addScaledVector(forward, -up.dot(forward));

  let rollBase = 0;
  if (referenceUp.lengthSq() > 1e-6 && projectedUp.lengthSq() > 1e-6) {
    referenceUp.normalize();
    projectedUp.normalize();
    const cross = new THREE.Vector3().crossVectors(referenceUp, projectedUp);
    rollBase = Math.atan2(cross.dot(forward), referenceUp.dot(projectedUp));
  }

  return {
    pitch: clamp(pitchBase * DIGITAL_TWIN_TUNING.headPitchSign * DIGITAL_TWIN_TUNING.headPitchGain, -0.6, 0.6),
    yaw: clamp(yawBase * DIGITAL_TWIN_TUNING.headYawSign * DIGITAL_TWIN_TUNING.headYawGain, -DIGITAL_TWIN_TUNING.headYawClamp, DIGITAL_TWIN_TUNING.headYawClamp),
    roll: clamp(rollBase * DIGITAL_TWIN_TUNING.headRollSign * DIGITAL_TWIN_TUNING.headRollGain, -0.5, 0.5),
  };
}
