import * as THREE from 'three';
import type { FaceTwinTracking } from '../tracking/types';
import {
  adaptFacecapBlendshapes,
  FACS_CONTROL_KEYS,
  FACS_PREVIOUS_VALUES,
  HEAD_RIG_TRACKING_MAP,
  simulateWrinkleUniforms,
  type FacsControlKey,
  type SkinShaderControls,
  type SkinUniformRefs,
  type WrinkleSimulationState,
  type WrinkleUniformRefs,
  updateSkinUniforms,
} from './materials';
import type { MouthSafetyProfile } from './mouthSafety';

export type FaceRigBoneControls = {
  headPitch: number;
  headYaw: number;
  headRoll: number;
  leftEyeYaw: number;
  rightEyeYaw: number;
};

export type FaceRigEyeAnimationMode = 'mouse' | 'calm' | 'saccades' | 'scanning';

export type FaceRigMorphBinding = {
  mesh: THREE.Mesh;
  indices: Partial<Record<FacsControlKey, number>>;
};

export type FaceRigRuntimeState = {
  previousMorphValues: Record<FacsControlKey, number>;
  saccadeTarget: THREE.Vector2;
  nextSaccadeMoveTime: number;
};

export type FaceRigRuntimeUpdateOptions = {
  time: number;
  delta: number;
  faceTracking: FaceTwinTracking | null | undefined;
  facsControls: Record<FacsControlKey, number>;
  boneControls: FaceRigBoneControls;
  skinShaderControls: SkinShaderControls;
  mouthSafety?: MouthSafetyProfile;
  morphBindings: FaceRigMorphBinding[];
  headNode?: THREE.Object3D;
  leftEyeNode?: THREE.Object3D;
  rightEyeNode?: THREE.Object3D;
  wrinkleUniforms: WrinkleUniformRefs;
  wrinkleSimulation: WrinkleSimulationState;
  skinUniforms: SkinUniformRefs;
  state: FaceRigRuntimeState;
  eyeAnimationMode: FaceRigEyeAnimationMode;
};

export function createFaceRigRuntimeState(saccadeTarget = new THREE.Vector2()): FaceRigRuntimeState {
  return {
    previousMorphValues: { ...FACS_PREVIOUS_VALUES },
    saccadeTarget,
    nextSaccadeMoveTime: 0,
  };
}

export function updateFaceRigRuntime({
  time,
  delta,
  faceTracking,
  facsControls,
  boneControls,
  skinShaderControls,
  mouthSafety,
  morphBindings,
  headNode,
  leftEyeNode,
  rightEyeNode,
  wrinkleUniforms,
  wrinkleSimulation,
  skinUniforms,
  state,
  eyeAnimationMode,
}: FaceRigRuntimeUpdateOptions) {
  const trackedBlendshapes = faceTracking?.status === 'tracking' ? faceTracking.blendshapes : null;
  const trackedHead = faceTracking?.status === 'tracking' ? faceTracking.headRotation : null;

  let morphsChanged = false;
  const rawMorphValues = {} as Record<FacsControlKey, number>;
  for (const key of FACS_CONTROL_KEYS) {
    const nextValue = trackedBlendshapes?.[key] ?? facsControls[key];
    rawMorphValues[key] = nextValue;
  }

  const nextMorphValues = adaptFacecapBlendshapes(rawMorphValues, mouthSafety);

  for (const key of FACS_CONTROL_KEYS) {
    if (Math.abs(nextMorphValues[key] - state.previousMorphValues[key]) > 0.001) {
      morphsChanged = true;
    }
  }

  simulateWrinkleUniforms(
    wrinkleUniforms,
    wrinkleSimulation,
    nextMorphValues,
    delta,
  );
  updateSkinUniforms(skinUniforms, nextMorphValues, skinShaderControls);

  if (morphsChanged) {
    for (const binding of morphBindings) {
      const influences = binding.mesh.morphTargetInfluences;
      if (!influences) continue;

      for (const key of FACS_CONTROL_KEYS) {
        const index = binding.indices[key];
        if (index !== undefined) influences[index] = nextMorphValues[key];
      }
    }

    state.previousMorphValues = nextMorphValues;
  }

  if (headNode) {
    const headPitch = trackedHead?.pitch ?? boneControls.headPitch;
    const headYaw = trackedHead?.yaw ?? boneControls.headYaw;
    const headRoll = trackedHead?.roll ?? boneControls.headRoll;

    headNode.rotation.x = headPitch * HEAD_RIG_TRACKING_MAP.pitchSign;
    headNode.rotation.y = headRoll * HEAD_RIG_TRACKING_MAP.rollToYSign;
    headNode.rotation.z = headYaw * HEAD_RIG_TRACKING_MAP.yawToZSign;
  }

  if (leftEyeNode) leftEyeNode.rotation.y = trackedHead ? 0 : boneControls.leftEyeYaw;
  if (rightEyeNode) rightEyeNode.rotation.y = trackedHead ? 0 : boneControls.rightEyeYaw;

  if (!trackedHead && eyeAnimationMode === 'saccades' && time > state.nextSaccadeMoveTime) {
    const isMacro = Math.random() > 0.8;
    if (isMacro) {
      state.saccadeTarget.x = (Math.random() - 0.5) * 1.2;
      state.saccadeTarget.y = (Math.random() - 0.5) * 0.8;
    } else {
      state.saccadeTarget.x += (Math.random() - 0.5) * 0.2;
      state.saccadeTarget.y += (Math.random() - 0.5) * 0.2;
    }

    state.saccadeTarget.x = THREE.MathUtils.clamp(state.saccadeTarget.x, -0.8, 0.8);
    state.saccadeTarget.y = THREE.MathUtils.clamp(state.saccadeTarget.y, -0.5, 0.5);

    const pause = isMacro ? (Math.random() * 1.0 + 0.5) : (Math.random() * 0.2 + 0.05);
    state.nextSaccadeMoveTime = time + pause;
  }

  return nextMorphValues;
}
