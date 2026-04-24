import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BASIS_TRANSCODER_PATH, FACECAP_MODEL_URL } from '../../config/assets';
import {
  applyExpressionMorphsToMesh,
  createStabilizedSkinGeometry,
  isConditionedHeadMesh,
  isConditioningExcludedMesh,
  resolveConditioningMeshRoles,
} from './conditioning';
import type { BeautyLabMaterialFactory } from './materials';
import type {
  BeautyMaterialMode,
  DebugSegment,
  ExpressionControlValues,
  FacecapConditioningData,
} from './types';
import type { SkinUniforms } from './uniforms';

export function SceneGrade({ exposure }: { exposure: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.toneMapping = THREE.AgXToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMappingExposure = exposure;
    scene.backgroundIntensity = 1;
    scene.environmentIntensity = 1.2;
    scene.background = new THREE.Color('#1a1a1e');
  }, [exposure, gl, scene]);
  return null;
}

export function BeautyBust({
  mode,
  skinUniforms,
  expressions,
  debugSegment,
  position,
  scale,
  conditioningData,
  materialFactory,
}: {
  mode: BeautyMaterialMode;
  skinUniforms: SkinUniforms | null;
  expressions: ExpressionControlValues;
  debugSegment: DebugSegment;
  position: [number, number, number];
  scale: number;
  conditioningData: FacecapConditioningData;
  materialFactory: BeautyLabMaterialFactory;
}) {
  const gl = useThree((state) => state.gl);
  const conditioningMeshRoles = useMemo(() => resolveConditioningMeshRoles(conditioningData), [conditioningData]);

  const { scene: sourceScene } = useGLTF(FACECAP_MODEL_URL, true, true, (loader) => {
    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath(BASIS_TRANSCODER_PATH);
    ktx2Loader.detectSupport(gl);
    loader.setKTX2Loader(ktx2Loader as any);
  });

  const scene = useMemo(() => {
    const clone = cloneSkeleton(sourceScene);
    clone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) => material.clone());
        return;
      }

      if (isConditionedHeadMesh(mesh, conditioningMeshRoles)) {
        mesh.geometry = createStabilizedSkinGeometry(mesh, conditioningData, conditioningMeshRoles);
        mesh.updateMorphTargets();
        if (mode === 'debug') {
          mesh.material = materialFactory.createDebugMaterial(debugSegment);
        } else if (mode === 'beauty' && skinUniforms) {
          mesh.material = materialFactory.createBeautyMaterial(skinUniforms);
        } else {
          mesh.material = materialFactory.createBaselineMaterial();
        }
      } else if (isConditioningExcludedMesh(mesh, conditioningMeshRoles)) {
        mesh.material = mesh.material.clone();
      } else {
        mesh.material = mesh.material.clone();
      }
    });
    return clone;
  }, [conditioningData, conditioningMeshRoles, debugSegment, materialFactory, mode, skinUniforms, sourceScene]);

  useEffect(() => {
    scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      if (!isConditionedHeadMesh(mesh, conditioningMeshRoles)) return;
      applyExpressionMorphsToMesh(mesh, expressions);
    });
  }, [conditioningMeshRoles, expressions, scene]);

  return <primitive object={scene} position={position} scale={scale} />;
}

export function StudioLightRig() {
  const { scene } = useThree();
  const keyRef = useRef<THREE.SpotLight>(null);
  const rimRef = useRef<THREE.SpotLight>(null);

  useEffect(() => {
    const faceTarget = new THREE.Vector3(0, -0.15, -1.0);
    const targets: THREE.Object3D[] = [];
    [keyRef.current, rimRef.current].forEach((light) => {
      if (light) {
        light.target.position.copy(faceTarget);
        scene.add(light.target);
        targets.push(light.target);
      }
    });
    return () => {
      targets.forEach((target) => scene.remove(target));
    };
  }, [scene]);

  return (
    <>
      <spotLight
        ref={keyRef}
        position={[3.5, 3.8, 4.5]}
        angle={0.32}
        penumbra={0.6}
        intensity={6.5}
        color="#fff5eb"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-3.2, 1.5, 3.0]} intensity={1.2} color="#d4e5f7" />
      <spotLight
        ref={rimRef}
        position={[-1.5, 3.5, -3.0]}
        angle={0.5}
        penumbra={0.8}
        intensity={3.5}
        color="#ffe8d6"
      />
      <pointLight position={[0, -2.4, -0.5]} intensity={1.5} color="#ffd4c0" />
      <ambientLight intensity={0.18} />
      <hemisphereLight args={['#e8edf2', '#3d3530', 0.35]} />
    </>
  );
}
