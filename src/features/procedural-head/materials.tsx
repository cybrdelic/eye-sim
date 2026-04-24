import * as THREE from 'three';
import type { ProceduralHeadMaterialMode, ProceduralHeadQuality } from './types';
import type { ProceduralSkinTexturePack } from './maps';

export function ProceduralBeautyMaterial({
  mode,
  quality,
  textures,
}: {
  mode: ProceduralHeadMaterialMode;
  quality: ProceduralHeadQuality;
  textures: ProceduralSkinTexturePack;
}) {
  const isTopology = mode === 'topology';
  const isMaps = mode === 'maps';

  return (
    <meshPhysicalMaterial
      map={isMaps ? textures.regionMap : textures.albedoMap}
      normalMap={isTopology ? null : textures.normalMap}
      roughnessMap={isTopology ? null : textures.roughnessMap}
      normalScale={new THREE.Vector2(quality === 'hero' ? 0.72 : quality === 'balanced' ? 0.52 : 0.32)}
      color={isTopology ? '#cab4a7' : '#ffffff'}
      wireframe={isTopology}
      roughness={isTopology ? 0.72 : 0.48}
      metalness={0}
      envMapIntensity={isTopology ? 0.55 : 1.1}
      clearcoat={isTopology ? 0 : 0.16}
      clearcoatRoughness={0.62}
      sheen={isTopology ? 0 : 0.28}
      sheenRoughness={0.78}
      sheenColor={new THREE.Color('#ffd2bf')}
      specularIntensity={isTopology ? 0.35 : 0.86}
      specularColor={new THREE.Color('#fff0e6')}
    />
  );
}

export function ProceduralLipMaterial({ mode }: { mode: ProceduralHeadMaterialMode }) {
  return (
    <meshPhysicalMaterial
      color={mode === 'maps' ? '#f04a84' : '#a55357'}
      roughness={0.42}
      metalness={0}
      envMapIntensity={0.9}
      clearcoat={0.18}
      clearcoatRoughness={0.5}
      specularIntensity={0.72}
      wireframe={mode === 'topology'}
    />
  );
}

export function ProceduralGumMaterial({ mode }: { mode: ProceduralHeadMaterialMode }) {
  return (
    <meshPhysicalMaterial
      color={mode === 'maps' ? '#d84d69' : '#8c3b45'}
      roughness={0.58}
      metalness={0}
      clearcoat={0.08}
      clearcoatRoughness={0.54}
      envMapIntensity={0.45}
      wireframe={mode === 'topology'}
    />
  );
}

export function ProceduralDentalMaterial({ mode }: { mode: ProceduralHeadMaterialMode }) {
  return (
    <meshPhysicalMaterial
      color={mode === 'maps' ? '#fff6d8' : '#e8dfc8'}
      roughness={0.34}
      metalness={0}
      clearcoat={0.28}
      clearcoatRoughness={0.25}
      envMapIntensity={0.72}
      specularIntensity={0.65}
      wireframe={mode === 'topology'}
    />
  );
}

export function ProceduralTongueMaterial({ mode }: { mode: ProceduralHeadMaterialMode }) {
  return (
    <meshPhysicalMaterial
      color={mode === 'maps' ? '#e75f75' : '#904252'}
      roughness={0.5}
      metalness={0}
      clearcoat={0.15}
      clearcoatRoughness={0.38}
      envMapIntensity={0.42}
      wireframe={mode === 'topology'}
    />
  );
}

export function ProceduralEyeMaterials({ mode }: { mode: ProceduralHeadMaterialMode }) {
  return {
    sclera: (
      <meshPhysicalMaterial
        color={mode === 'maps' ? '#e5f3ff' : '#e7dfd4'}
        roughness={0.28}
        metalness={0}
        clearcoat={0.35}
        clearcoatRoughness={0.22}
        envMapIntensity={0.85}
        wireframe={mode === 'topology'}
      />
    ),
    iris: (
      <meshPhysicalMaterial
        color={mode === 'maps' ? '#46a7d8' : '#4d8a76'}
        roughness={0.36}
        metalness={0}
        clearcoat={0.18}
        envMapIntensity={0.75}
        wireframe={mode === 'topology'}
      />
    ),
    pupil: <meshBasicMaterial color="#070707" wireframe={mode === 'topology'} />,
    cornea: (
      <meshPhysicalMaterial
        color="#ffffff"
        transparent
        opacity={mode === 'topology' ? 0.12 : 0.22}
        roughness={0.02}
        metalness={0}
        transmission={0.35}
        thickness={0.08}
        envMapIntensity={1.4}
        wireframe={mode === 'topology'}
      />
    ),
  };
}
