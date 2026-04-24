import { useGLTF } from '@react-three/drei';
import { createPortal, type ThreeElements, useFrame, useThree } from '@react-three/fiber';
import { button, folder, useControls } from 'leva';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { KTX2Loader } from 'three-stdlib';
import type { FaceTwinTracking } from '../hooks/useMediaPipeFaceTwin';
import {
  BEAUTY_SHADER_VERSION,
  createDentalMaterial,
  createSkinUniformRefs,
  createWrinkleBeautyMaterial,
  createWrinkleSimulationState,
  createWrinkleUniformRefs,
  FACS_CONTROL_DEFAULTS,
  FACS_CONTROL_KEYS,
  isDentalCandidateMesh,
  type FaceViewMode,
  type FacsControlKey,
  type SkinShaderControls,
} from '../features/face/materials';
import {
  computeEyeBasisCorrection,
  computeEyeFit,
  computeEyeRotationLimitsFromScene,
  createEyeLimitScratch,
  getHeadForwardReference,
  isDescendantOf,
  isUnderCustomEyeRoot,
  listEyeMeshes,
  type EyeFit,
  type EyeRotationLimits,
  type EyeRotationLimitsMutable,
} from '../features/face/eyeFit';
import type { MouthSafetyProfile } from '../features/face/mouthSafety';
import { createFaceRigRuntimeState, updateFaceRigRuntime, type FaceRigMorphBinding } from '../features/face/runtime';
import Eye from './Eye';

const FACECAP_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/facecap.glb';
const DEV_LOGGING = import.meta.env.DEV;
type FaceEyeProps = Omit<ComponentProps<typeof Eye>, 'trackedGaze' | 'saccadeTarget' | 'rotationLimits' | 'isRightEye' | 'blink'>;

export type FaceProps = ThreeElements['group'] & {
  viewMode?: FaceViewMode;
  showCustomEyes?: boolean;
  eyeProps: FaceEyeProps;
  faceTracking?: FaceTwinTracking | null;
  mouthSafety?: MouthSafetyProfile;
};

export default function Face({
  viewMode = 'beauty',
  showCustomEyes = true,
  eyeProps,
  faceTracking,
  mouthSafety,
  ...props
}: FaceProps) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);

  const { scene } = useGLTF(FACECAP_URL, true, true, (loader) => {
    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/');
    ktx2Loader.detectSupport(gl);
    loader.setKTX2Loader(ktx2Loader);
  });

  const morphMeshes = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).morphTargetInfluences) {
        meshes.push(child as THREE.Mesh);
      }
    });
    return meshes;
  }, [scene]);

  const nodes = useMemo(() => {
    const next: Record<string, THREE.Object3D> = {};
    scene.traverse((child) => {
      next[child.name] = child;
    });
    return next;
  }, [scene]);

  const leftEyeNode = nodes.grp_eyeLeft || nodes.eyeLeft;
  const rightEyeNode = nodes.grp_eyeRight || nodes.eyeRight;
  const dynamicEyeLimitsEnabled = false;

  const debugControls = useControls('Debug', {
    'Eye Fit': folder({
      showEyeHelpers: false,
      showEyeBoundingSpheres: false,
      showOriginalEyeMeshes: false,
      dumpLeftEyeMeshes: button(() => {
        const node = nodes.grp_eyeLeft || nodes.eyeLeft;
        if (!node) return;
        console.table(listEyeMeshes(node).map((mesh) => ({
          name: mesh.name,
          uuid: mesh.uuid,
          radius: Number(mesh.radius.toFixed(5)),
          worldRadius: Number(mesh.worldRadius.toFixed(5)),
          sphericity: Number(mesh.sphericity.toFixed(3)),
          vertexCount: mesh.vertexCount,
          score: Number(mesh.score.toFixed(3)),
          center: `(${mesh.center.x.toFixed(3)}, ${mesh.center.y.toFixed(3)}, ${mesh.center.z.toFixed(3)})`,
          worldScale: `(${mesh.worldScale.x.toFixed(3)}, ${mesh.worldScale.y.toFixed(3)}, ${mesh.worldScale.z.toFixed(3)})`,
        })));
      }),
      dumpRightEyeMeshes: button(() => {
        const node = nodes.grp_eyeRight || nodes.eyeRight;
        if (!node) return;
        console.table(listEyeMeshes(node).map((mesh) => ({
          name: mesh.name,
          uuid: mesh.uuid,
          radius: Number(mesh.radius.toFixed(5)),
          worldRadius: Number(mesh.worldRadius.toFixed(5)),
          sphericity: Number(mesh.sphericity.toFixed(3)),
          vertexCount: mesh.vertexCount,
          score: Number(mesh.score.toFixed(3)),
          center: `(${mesh.center.x.toFixed(3)}, ${mesh.center.y.toFixed(3)}, ${mesh.center.z.toFixed(3)})`,
          worldScale: `(${mesh.worldScale.x.toFixed(3)}, ${mesh.worldScale.y.toFixed(3)}, ${mesh.worldScale.z.toFixed(3)})`,
        })));
      }),
    }),
  });

  const facsControls = useControls('FACS Blendshapes (Muscles)', FACS_CONTROL_DEFAULTS);
  const boneControls = useControls('Skeletal Rig (Bones)', {
    headPitch: { value: 0, min: -1, max: 1 },
    headYaw: { value: 0, min: -1, max: 1 },
    headRoll: { value: 0, min: -1, max: 1 },
    leftEyeYaw: { value: 0, min: -0.5, max: 0.5 },
    rightEyeYaw: { value: 0, min: -0.5, max: 0.5 },
  });
  const skinShaderControls = useControls('Skin Shader', {
    poreAoStrength: { value: 0.7, min: 0, max: 1.5, step: 0.01 },
    displacementAmount: { value: 0.85, min: 0, max: 2, step: 0.01 },
    sssStrength: { value: 1.2, min: 0, max: 2.5, step: 0.01 },
    thicknessLip: { value: 1.4, min: 0.4, max: 2.5, step: 0.01 },
    thicknessNose: { value: 0.92, min: 0.4, max: 2.0, step: 0.01 },
    thicknessUnderEye: { value: 1.18, min: 0.4, max: 2.5, step: 0.01 },
    thicknessCheek: { value: 1.08, min: 0.4, max: 2.5, step: 0.01 },
    thicknessForehead: { value: 0.78, min: 0.3, max: 2.0, step: 0.01 },
  }) as SkinShaderControls;

  const leftRotationLimits = useMemo<EyeRotationLimitsMutable>(() => ({
    yawMax: 0.55,
    pitchUpMax: 0.35,
    pitchDownMax: 0.45,
    source: 'fallback',
  }), []);
  const rightRotationLimits = useMemo<EyeRotationLimitsMutable>(() => ({
    yawMax: 0.55,
    pitchUpMax: 0.35,
    pitchDownMax: 0.45,
    source: 'fallback',
  }), []);
  const leftLimitScratch = useMemo(() => createEyeLimitScratch(), []);
  const rightLimitScratch = useMemo(() => createEyeLimitScratch(), []);
  const sharedSaccadeTarget = useMemo(() => new THREE.Vector2(), []);
  const faceRigRuntimeRef = useRef(createFaceRigRuntimeState(sharedSaccadeTarget));
  const wrinkleUniformsRef = useRef(createWrinkleUniformRefs());
  const wrinkleSimulationRef = useRef(createWrinkleSimulationState());
  const skinUniformsRef = useRef(createSkinUniformRefs());
  const eyeFitWarningsRef = useRef({
    autoScale: false,
    suspiciousSize: false,
  });

  const morphBindings = useMemo(() => {
    return morphMeshes.map((mesh) => {
      const indices = {} as Partial<Record<FacsControlKey, number>>;
      for (const key of FACS_CONTROL_KEYS) {
        const index = mesh.morphTargetDictionary?.[key];
        if (index !== undefined) indices[key] = index;
      }
      return { mesh, indices };
    });
  }, [morphMeshes]) satisfies FaceRigMorphBinding[];

  const headNode = nodes.grp_transform || nodes.head || nodes.Head;

  const eyeFits = useMemo(() => {
    scene.updateMatrixWorld(true);

    const forwardRefWorld = getHeadForwardReference(headNode, camera);
    const upRefWorld = new THREE.Vector3(0, 1, 0);
    const camPos = camera.position.clone();
    const left = leftEyeNode ? computeEyeFit(leftEyeNode, forwardRefWorld, upRefWorld, camPos) : null;
    const right = rightEyeNode ? computeEyeFit(rightEyeNode, forwardRefWorld, upRefWorld, camPos) : null;

    if (leftEyeNode && rightEyeNode && left?.fit && right?.fit) {
      const leftPos = new THREE.Vector3();
      const rightPos = new THREE.Vector3();
      leftEyeNode.getWorldPosition(leftPos);
      rightEyeNode.getWorldPosition(rightPos);
      const interEyeDist = leftPos.distanceTo(rightPos);

      const leftNodeScale = new THREE.Vector3();
      const rightNodeScale = new THREE.Vector3();
      leftEyeNode.getWorldScale(leftNodeScale);
      rightEyeNode.getWorldScale(rightNodeScale);

      const leftWorldRadius = Math.max(
        Math.abs(leftNodeScale.x * left.fit.scale.x),
        Math.abs(leftNodeScale.y * left.fit.scale.y),
        Math.abs(leftNodeScale.z * left.fit.scale.z),
      );
      const rightWorldRadius = Math.max(
        Math.abs(rightNodeScale.x * right.fit.scale.x),
        Math.abs(rightNodeScale.y * right.fit.scale.y),
        Math.abs(rightNodeScale.z * right.fit.scale.z),
      );

      const ratioL0 = interEyeDist > 0 ? leftWorldRadius / interEyeDist : Infinity;
      const ratioR0 = interEyeDist > 0 ? rightWorldRadius / interEyeDist : Infinity;
      const warnRatio = 0.45;
      const rejectRatio = 0.60;
      const minPreferred = 0.22;
      const maxPreferred = 0.30;

      const maxRatio0 = Math.max(ratioL0, ratioR0);
      const minRatio0 = Math.min(ratioL0, ratioR0);

      let scaleFactor = 1;
      if (Number.isFinite(maxRatio0) && maxRatio0 > maxPreferred) {
        scaleFactor = maxPreferred / maxRatio0;
      } else if (Number.isFinite(minRatio0) && minRatio0 > 0 && minRatio0 < minPreferred) {
        scaleFactor = minPreferred / minRatio0;
      }

      let leftWorldRadiusUsed = leftWorldRadius;
      let rightWorldRadiusUsed = rightWorldRadius;
      let ratioLUsed = ratioL0;
      let ratioRUsed = ratioR0;

      if (scaleFactor !== 1) {
        left.fit.scale = left.fit.scale.clone().multiplyScalar(scaleFactor);
        right.fit.scale = right.fit.scale.clone().multiplyScalar(scaleFactor);

        leftWorldRadiusUsed = Math.max(
          Math.abs(leftNodeScale.x * left.fit.scale.x),
          Math.abs(leftNodeScale.y * left.fit.scale.y),
          Math.abs(leftNodeScale.z * left.fit.scale.z),
        );
        rightWorldRadiusUsed = Math.max(
          Math.abs(rightNodeScale.x * right.fit.scale.x),
          Math.abs(rightNodeScale.y * right.fit.scale.y),
          Math.abs(rightNodeScale.z * right.fit.scale.z),
        );

        ratioLUsed = interEyeDist > 0 ? leftWorldRadiusUsed / interEyeDist : Infinity;
        ratioRUsed = interEyeDist > 0 ? rightWorldRadiusUsed / interEyeDist : Infinity;

        left.debug.scaleAutoFactor = scaleFactor;
        right.debug.scaleAutoFactor = scaleFactor;
        left.debug.scaleAutoRatioBefore = ratioL0;
        right.debug.scaleAutoRatioBefore = ratioR0;
        left.debug.scaleAutoRatioAfter = ratioLUsed;
        right.debug.scaleAutoRatioAfter = ratioRUsed;

        if (!eyeFitWarningsRef.current.autoScale) {
          eyeFitWarningsRef.current.autoScale = true;
          if (DEV_LOGGING) {
            console.info('[eye-fit] auto-calibrated eye scale', {
              interEyeDist,
              scaleFactor,
              before: { leftRatio: ratioL0, rightRatio: ratioR0 },
              after: { leftRatio: ratioLUsed, rightRatio: ratioRUsed },
              preferred: { min: minPreferred, max: maxPreferred },
            });
          }
        }
      }

      if ((ratioLUsed > warnRatio || ratioRUsed > warnRatio) && !eyeFitWarningsRef.current.suspiciousSize) {
        eyeFitWarningsRef.current.suspiciousSize = true;
        if (DEV_LOGGING) {
          console.warn('[eye-fit] suspicious eye size ratio', {
            interEyeDist,
            left: { worldRadius: leftWorldRadiusUsed, ratio: ratioLUsed, picked: left.debug },
            right: { worldRadius: rightWorldRadiusUsed, ratio: ratioRUsed, picked: right.debug },
            warnRatio,
            rejectRatio,
          });
        }
      }

      if (ratioLUsed > rejectRatio || ratioRUsed > rejectRatio) {
        if (DEV_LOGGING) {
          console.warn('[eye-fit] rejected implausible fit', {
            interEyeDist,
            left: { worldRadius: leftWorldRadiusUsed, ratio: ratioLUsed, picked: left.debug },
            right: { worldRadius: rightWorldRadiusUsed, ratio: ratioRUsed, picked: right.debug },
            rejectRatio,
          });
        }
        return { left: null, right: null };
      }
    }

    return { left, right };
  }, [camera, headNode, leftEyeNode, rightEyeNode, scene]);

  const fallbackFit: EyeFit = useMemo(() => ({
    position: new THREE.Vector3(0, 0, 0.02),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(0.85, 0.85, 0.85),
  }), []);

  const forwardForFallback = useMemo(() => getHeadForwardReference(headNode, camera), [camera, headNode]);
  const upForFallback = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  const leftFallbackQuat = useMemo(() => (
    leftEyeNode
      ? computeEyeBasisCorrection(leftEyeNode, forwardForFallback, upForFallback).quaternion
      : fallbackFit.quaternion
  ), [fallbackFit.quaternion, forwardForFallback, leftEyeNode, upForFallback]);

  const rightFallbackQuat = useMemo(() => (
    rightEyeNode
      ? computeEyeBasisCorrection(rightEyeNode, forwardForFallback, upForFallback).quaternion
      : fallbackFit.quaternion
  ), [fallbackFit.quaternion, forwardForFallback, rightEyeNode, upForFallback]);

  const leftFit = eyeFits.left?.fit ?? { ...fallbackFit, quaternion: leftFallbackQuat };
  const rightFit = eyeFits.right?.fit ?? { ...fallbackFit, quaternion: rightFallbackQuat };

  const occluderMeshes = useMemo(() => {
    const occluders: THREE.Object3D[] = [];
    for (const mesh of morphMeshes) {
      if (isUnderCustomEyeRoot(mesh)) continue;
      if (leftEyeNode && isDescendantOf(mesh, leftEyeNode)) continue;
      if (rightEyeNode && isDescendantOf(mesh, rightEyeNode)) continue;
      occluders.push(mesh);
    }
    return occluders;
  }, [leftEyeNode, morphMeshes, rightEyeNode]);

  const limitsUpdateRef = useRef({
    lastT: -Infinity,
    lastBlinkL: 0,
    lastBlinkR: 0,
    lastHeadQuat: new THREE.Quaternion(),
    hasLastHeadQuat: false,
    warnedLeftFallback: false,
    warnedRightFallback: false,
  });

  useFrame((_, delta) => {
    const t = performance.now() * 0.001;
    updateFaceRigRuntime({
      time: t,
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
      wrinkleUniforms: wrinkleUniformsRef.current,
      wrinkleSimulation: wrinkleSimulationRef.current,
      skinUniforms: skinUniformsRef.current,
      state: faceRigRuntimeRef.current,
      eyeAnimationMode: eyeProps.animationMode,
    });

    if (!dynamicEyeLimitsEnabled || !showCustomEyes || !occluderMeshes.length) return;

    const minInterval = 0.10;
    const blinkEps = 0.02;
    const state = limitsUpdateRef.current;
    const blinkL = facsControls.eyeBlink_L;
    const blinkR = facsControls.eyeBlink_R;

    const headQuat = new THREE.Quaternion();
    if (headNode) headNode.getWorldQuaternion(headQuat);

    let headChanged = false;
    if (headNode) {
      if (!state.hasLastHeadQuat) {
        state.lastHeadQuat.copy(headQuat);
        state.hasLastHeadQuat = true;
        headChanged = true;
      } else {
        const dot = Math.abs(state.lastHeadQuat.dot(headQuat));
        headChanged = dot < 0.9995;
      }
    }

    const blinkChanged = Math.abs(blinkL - state.lastBlinkL) > blinkEps || Math.abs(blinkR - state.lastBlinkR) > blinkEps;
    const timeOk = t - state.lastT > minInterval;
    if (!timeOk || (!blinkChanged && !headChanged)) return;

    state.lastT = t;
    state.lastBlinkL = blinkL;
    state.lastBlinkR = blinkR;
    if (headNode) state.lastHeadQuat.copy(headQuat);

    const eyeRadiusLocal = 1.03;

    if (leftEyeNode) {
      const result = computeEyeRotationLimitsFromScene({
        eyeNode: leftEyeNode,
        fit: leftFit,
        eyeRadiusLocal,
        occluders: occluderMeshes,
        scratch: leftLimitScratch,
      });
      leftRotationLimits.yawMax = result.yawMax;
      leftRotationLimits.pitchUpMax = result.pitchUpMax;
      leftRotationLimits.pitchDownMax = result.pitchDownMax;
      leftRotationLimits.source = result.source;
      if (result.source === 'fallback' && !state.warnedLeftFallback) {
        state.warnedLeftFallback = true;
        if (DEV_LOGGING) {
          console.warn('[eye-fit] left eye rotation limits fell back (raycast unreliable)', result);
        }
      }
    }

    if (rightEyeNode) {
      const result = computeEyeRotationLimitsFromScene({
        eyeNode: rightEyeNode,
        fit: rightFit,
        eyeRadiusLocal,
        occluders: occluderMeshes,
        scratch: rightLimitScratch,
      });
      rightRotationLimits.yawMax = result.yawMax;
      rightRotationLimits.pitchUpMax = result.pitchUpMax;
      rightRotationLimits.pitchDownMax = result.pitchDownMax;
      rightRotationLimits.source = result.source;
      if (result.source === 'fallback' && !state.warnedRightFallback) {
        state.warnedRightFallback = true;
        if (DEV_LOGGING) {
          console.warn('[eye-fit] right eye rotation limits fell back (raycast unreliable)', result);
        }
      }
    }
  });

  useEffect(() => {
    scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;

      const mesh = child as THREE.Mesh;
      if (isUnderCustomEyeRoot(mesh)) return;

      if (mesh.userData.originalVisible === undefined) {
        mesh.userData.originalVisible = mesh.visible;
      }

      const shouldHideOriginalEyeMesh =
        showCustomEyes &&
        !debugControls.showOriginalEyeMeshes &&
        leftEyeNode &&
        rightEyeNode &&
        (isDescendantOf(mesh, leftEyeNode) || isDescendantOf(mesh, rightEyeNode));

      mesh.visible = shouldHideOriginalEyeMesh ? false : (mesh.userData.originalVisible as boolean);

      if (!mesh.userData.originalMaterial) {
        mesh.userData.originalMaterial = mesh.material;
      }

      const materialCache = (mesh.userData.__viewModeMaterials ??= {}) as Record<string, THREE.Material>;
      const cacheKey = viewMode === 'beauty'
        ? `beauty:${BEAUTY_SHADER_VERSION}:${(mesh.userData.originalMaterial as THREE.Material)?.uuid ?? 'none'}`
        : viewMode;
      const dentalCacheKey = `dental:${(mesh.userData.originalMaterial as THREE.Material)?.uuid ?? 'none'}`;

      if (viewMode === 'beauty') {
        if (isDentalCandidateMesh(mesh, mesh.userData.originalMaterial as THREE.Material)) {
          if (!materialCache[dentalCacheKey]) {
            materialCache[dentalCacheKey] = createDentalMaterial(
              mesh.userData.originalMaterial as THREE.Material,
              mesh,
            );
          }

          mesh.material = materialCache[dentalCacheKey] ?? (mesh.userData.originalMaterial as THREE.Material);
          return;
        }

        if (!materialCache[cacheKey]) {
          materialCache[cacheKey] = createWrinkleBeautyMaterial(
            mesh.userData.originalMaterial as THREE.Material,
            mesh,
            wrinkleUniformsRef.current,
            skinUniformsRef.current,
          );
        }

        mesh.material = materialCache[cacheKey] ?? (mesh.userData.originalMaterial as THREE.Material);
        return;
      }

      if (!materialCache[cacheKey]) {
        if (viewMode === 'wireframe') {
          materialCache[cacheKey] = new THREE.MeshBasicMaterial({ color: '#00ff00', wireframe: true });
        } else if (viewMode === 'normals') {
          materialCache[cacheKey] = new THREE.MeshNormalMaterial();
        } else if (viewMode === 'depth') {
          materialCache[cacheKey] = new THREE.MeshDepthMaterial();
        } else if (viewMode === 'basic') {
          materialCache[cacheKey] = new THREE.MeshBasicMaterial({ color: '#cccccc' });
        }
      }

      if (materialCache[cacheKey]) {
        mesh.material = materialCache[cacheKey];
      }
    });
  }, [debugControls.showOriginalEyeMeshes, leftEyeNode, rightEyeNode, scene, showCustomEyes, viewMode]);

  return (
    <group {...props}>
      <primitive object={scene} />
      {showCustomEyes && leftEyeNode && createPortal(
        <group
          position={leftFit.position}
          quaternion={leftFit.quaternion}
          scale={leftFit.scale}
          userData={{ __customEyeRoot: true }}
        >
          <Eye
            {...eyeProps}
            trackedGaze={faceTracking?.status === 'tracking' ? faceTracking.gaze.left : undefined}
            saccadeTarget={sharedSaccadeTarget}
            rotationLimits={leftRotationLimits}
            isRightEye={false}
            blink={faceTracking?.status === 'tracking' ? (faceTracking.blendshapes.eyeBlink_L ?? facsControls.eyeBlink_L) : facsControls.eyeBlink_L}
          />
          {debugControls.showEyeHelpers && <axesHelper args={[1.5]} />}
          {debugControls.showEyeBoundingSpheres && (
            <mesh>
              <sphereGeometry args={[1, 24, 24]} />
              <meshBasicMaterial wireframe color="#ffff00" />
            </mesh>
          )}
        </group>,
        leftEyeNode,
      )}
      {showCustomEyes && rightEyeNode && createPortal(
        <group
          position={rightFit.position}
          quaternion={rightFit.quaternion}
          scale={rightFit.scale}
          userData={{ __customEyeRoot: true }}
        >
          <Eye
            {...eyeProps}
            trackedGaze={faceTracking?.status === 'tracking' ? faceTracking.gaze.right : undefined}
            saccadeTarget={sharedSaccadeTarget}
            rotationLimits={rightRotationLimits}
            isRightEye
            blink={faceTracking?.status === 'tracking' ? (faceTracking.blendshapes.eyeBlink_R ?? facsControls.eyeBlink_R) : facsControls.eyeBlink_R}
          />
          {debugControls.showEyeHelpers && <axesHelper args={[1.5]} />}
          {debugControls.showEyeBoundingSpheres && (
            <mesh>
              <sphereGeometry args={[1, 24, 24]} />
              <meshBasicMaterial wireframe color="#ffff00" />
            </mesh>
          )}
        </group>,
        rightEyeNode,
      )}
    </group>
  );
}
